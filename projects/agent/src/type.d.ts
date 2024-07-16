declare global {
  type Seq<
    T extends number,
    Acc extends number[] = [],
  > = Acc["length"] extends T ? Acc : Seq<T, [...Acc, Acc["length"]]>
}

type decimal = Seq<11>

export {}
