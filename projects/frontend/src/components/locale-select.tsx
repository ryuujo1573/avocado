import { component$, getLocale } from "@builder.io/qwik";
import { useLocation } from "@builder.io/qwik-city";
import { localeNames, locales } from "compiled-i18n";

export const LocaleSelect = component$(() => {
  const currentLocale = getLocale();
  const location = useLocation();
  return (
    <>
      {locales.map((locale) => {
        const isCurrent = locale == currentLocale;
        return (
          <a
            key={locale}
            href={location.url.href.replace(
              /^[a-z]+:\/\/[^/]+\/([^/]+)/,
              (href, path) => href.replace(path, locale),
            )}
            aria-disabled={isCurrent}
            class={[
              "btn btn-ghost btn-sm",
              ...(isCurrent
                ? ["pointer-events-none bg-neutral-content text-neutral"]
                : ["bg-base-100 text-base-content"]),
            ]}
          >
            {localeNames[locale]}
          </a>
        );
      })}
    </>
  );
});
