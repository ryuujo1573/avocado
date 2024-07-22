import { component$ } from "@builder.io/qwik";
import { HiServerSolid } from "@qwikest/icons/heroicons";
import { localize } from "compiled-i18n";

export const pageMeta: PageMeta = {
  get name() {
    return localize`Server`;
  },
  id: "server",
  icon: <HiServerSolid />,
};

export default component$(() => {
  return <>Server</>;
});
