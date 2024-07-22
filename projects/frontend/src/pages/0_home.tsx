import { component$ } from "@builder.io/qwik";
import { HiHomeSolid } from "@qwikest/icons/heroicons";
import { localize } from "compiled-i18n";

export const pageMeta: PageMeta = {
  get name() {
    return localize`Home`;
  },
  id: "home",
  icon: <HiHomeSolid />,
};

export default component$(() => {
  return <>Home</>;
});
