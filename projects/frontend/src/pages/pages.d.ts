import type { JSXOutput } from "@builder.io/qwik";

declare global {
  type PageMeta = {
    name: string;
    id: string;
    icon: JSXOutput;
  };
}
