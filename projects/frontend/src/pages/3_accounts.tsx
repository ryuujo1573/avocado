import { component$ } from "@builder.io/qwik";
import { HiUserGroupSolid } from "@qwikest/icons/heroicons";
import { localize } from "compiled-i18n";

export const pageMeta: PageMeta = {
  get name() {
    return localize`Accounts`;
  },
  id: "accounts",
  icon: <HiUserGroupSolid />,
};

export default component$(() => {
  return <>Accounts</>;
});
