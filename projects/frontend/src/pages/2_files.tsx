import { component$ } from "@builder.io/qwik";
import { HiFolderSolid } from "@qwikest/icons/heroicons";
import { localize } from "compiled-i18n";

export const pageMeta: PageMeta = {
  get name() {
    return localize`Files`;
  },
  id: "files",
  icon: <HiFolderSolid />,
};

export default component$(() => {
  return <>Files</>;
});
