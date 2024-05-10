import type { InitPageResult, PayloadRequestWithData, VisibleEntities } from 'payload/types'

import { initI18n } from '@payloadcms/translations'
import { findLocaleFromCode } from '@payloadcms/ui/utilities/findLocaleFromCode'
import { headers as getHeaders } from 'next/headers.js'
import { parseCookies } from 'payload/auth'
import { createLocalReq, isEntityHidden } from 'payload/utilities'
import qs from 'qs'

import type { Args } from './types.js'

import { getPayloadHMR } from '../getPayloadHMR.js'
import { getRequestLanguage } from '../getRequestLanguage.js'
import { handleAdminPage } from './handleAdminPage.js'
import { handleAuthRedirect } from './handleAuthRedirect.js'

export const initPage = async ({
  config: configPromise,
  redirectUnauthenticatedUser = false,
  route,
  searchParams,
}: Args): Promise<InitPageResult> => {
  const headers = getHeaders()
  const localeParam = searchParams?.locale as string
  const payload = await getPayloadHMR({ config: configPromise })

  const {
    collections,
    globals,
    i18n: i18nConfig,
    localization,
    routes: { admin: adminRoute },
  } = payload.config

  const queryString = `${qs.stringify(searchParams ?? {}, { addQueryPrefix: true })}`
  const defaultLocale =
    localization && localization.defaultLocale ? localization.defaultLocale : 'en'
  const localeCode = localeParam || defaultLocale
  const locale = localization && findLocaleFromCode(localization, localeCode)
  const cookies = parseCookies(headers)
  const language = getRequestLanguage({ config: payload.config, cookies, headers })

  const i18n = await initI18n({
    config: i18nConfig,
    context: 'client',
    language,
  })

  const req = await createLocalReq(
    {
      fallbackLocale: null,
      locale: locale.code,
      req: {
        i18n,
        query: qs.parse(queryString, {
          depth: 10,
          ignoreQueryPrefix: true,
        }),
        url: `${payload.config.serverURL}${route}${searchParams ? queryString : ''}`,
      } as PayloadRequestWithData,
    },
    payload,
  )

  const { permissions, user } = await payload.auth({ headers, req })

  req.user = user

  const visibleEntities: VisibleEntities = {
    collections: collections
      .map(({ slug, admin: { hidden } }) => (!isEntityHidden({ hidden, user }) ? slug : null))
      .filter(Boolean),
    globals: globals
      .map(({ slug, admin: { hidden } }) => (!isEntityHidden({ hidden, user }) ? slug : null))
      .filter(Boolean),
  }

  if (redirectUnauthenticatedUser && !user) {
    handleAuthRedirect({
      adminRoute,
      redirectUnauthenticatedUser,
      route,
      searchParams,
    })
  }

  const { collectionConfig, docID, globalConfig } = handleAdminPage({
    adminRoute,
    config: payload.config,
    permissions,
    route,
  })

  return {
    collectionConfig,
    cookies,
    docID,
    globalConfig,
    locale,
    permissions,
    req,
    translations: i18n.translations,
    visibleEntities,
  }
}