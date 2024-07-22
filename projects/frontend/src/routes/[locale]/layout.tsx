import type { RequestHandler } from "@builder.io/qwik-city";
import { guessLocale, locales } from "compiled-i18n";

export const onRequest: RequestHandler = ({
  request,
  url,
  redirect,
  pathname,
  params,
  locale,
}) => {
  if (locales.includes(params.locale)) {
    locale(params.locale);
  } else {
    const acceptLang = request.headers.get("accept-language");
    // try the best match for user accept languages
    const locale = guessLocale(acceptLang);

    const hasLocale = /^([a-z]{2})([-_][a-z]{2})?$/i.test(params.locale);
    /**
     * @example [
     *    /unknown -> /en/unknown (has no locale)
     *    /fr-CA/some/path -> /en/some/path (locale not found, use default)
     * ]
     **/

    throw redirect(
      301,
      pathname.replace(hasLocale ? `/${params.locale}` : "", `/${locale}`) +
        url.search,
    );
  }
};

import { component$, Slot } from "@builder.io/qwik";

export default component$(() => {
  return <Slot />;
});
