//#region Type Definitions

declare global {
  interface Object {
    let<T, TR>(fn: (v: T) => TR): TR
    let<T, I, TR>(fn: (v: T) => I, fn2: (v: I) => TR): TR
    debugValue<T>(): T
  }

  type CB<T = any, TR = any> = (v: T) => TR
  type Fn<TArr extends any[] = any[], TR = any> = (...args: TArr) => TR

  type FirstN<
    N extends number,
    V extends any[],
    Acc extends any[] = [],
  > = Acc["length"] extends N ? Acc : FirstN<N, V, [...Acc, V[Acc["length"]]]>

  type Taken<F extends Fn, X extends number> = (
    ...args: F extends Fn<infer ArgV> ? FirstN<X, ArgV> : []
  ) => F extends Fn<any[], infer TR> ? TR : never

  interface Function {
    take<T extends Fn, C extends number>(
      this: T,
      count: C,
    ): Taken<typeof this, C>
  }
}
//#endregion

//#region Type Tests
namespace test {
  type args = [0, "a", false]

  type partial = FirstN<2, args>
  // -> [0, "a"]
}
//#endregion

//#region Ext Impl

function $let<T, TR>(this: T, fn: (v: T) => TR): TR
function $let<T, I, TR>(this: T, fn: (v: T) => I, fn2: (v: I) => TR): TR
function $let<T, FnArray extends ((input: any) => any)[]>(
  this: T & {},
  ...fns: FnArray
): FnArray extends [...args: CB[], CB<any, infer R>] ? R : never {
  return fns.reduce((acc, fn) => fn(acc), this.valueOf()) as unknown as any
}

function $debugValue<T>(this: T) {
  console.debug("[value] %o", this)
  return this
}

function $take<T extends Fn, C extends number>(this: T, count: C): Taken<T, C> {
  return (...args: unknown[]) => {
    return this(...args.slice(0, count))
  }
}

Object.defineProperties(Object.prototype, {
  let: {
    value: $let,
  },
  debugValue: {
    value: $debugValue,
  },
})

Object.defineProperties(Function.prototype, {
  take: {
    value: $take,
  },
})

//#endregion

export {}
