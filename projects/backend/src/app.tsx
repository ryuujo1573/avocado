import { Context, Env, Hono } from "hono";
import { upgradeWebSocket } from "./adapter";
import { Prisma, PrismaClient } from "@avocado/core/orm";
import { logger as log, logger } from "@avocado/core/qos";

declare global {
  interface AppEnv extends Env {
    Variables: {};
  }
}

const db = new PrismaClient();

db.$connect().catch((e) => {
  logger.e(e);
});

const app = new Hono<AppEnv>()
  .use((c, next) => {
    return next();
  })
  .get("/__register__", async (c) => {
    const rand = Array.from(crypto.getRandomValues(new Uint8Array(6)));

    const randStr = rand.map((v) => v.toString(16)).join("");
    return c.html(
      <div>
        <style>{`.col { display: flex; flex-direction: column; width: min-content; gap: .4rem; }`}</style>
        <form class="col" method="post" target="resp">
          <label for="uid">User ID</label>
          <input type="text" name="uid" value={`test_${randStr}`} />
          <label for="name">Nick name</label>
          <input type="text" name="name" value="John Doe" />
          <label for="email">Email</label>
          <input type="text" name="email" value={`${randStr}@example.com`} />
          <input type="submit">Submit</input>
        </form>
        <iframe name="resp" />
      </div>,
    );
  })
  .post("/__register__", async (c) => {
    const { uid, name, email } =
      c.req.header("Contect-Type") == "application/json"
        ? await c.req.json()
        : (Object.fromEntries(
            (await c.req.formData()).entries(),
          ) as unknown as Prisma.UserCreateInput);

    const pick = {
      uid,
      name,
      email,
    };

    const existed = await db.user.findFirst({
      where: {
        OR: [{ uid }, { email }],
      },
    });

    if (existed) {
      return c.json({ error: "User exists" }, 400);
    }

    await db.user.create({
      data: {
        ...pick,
      },
    });

    return c.json({ status: "ok" });
  })
  .get("/users", async (c) => {
    return c.json(await db.user.findMany());
  })
  .get("/sync.magic", async (c, next) => {
    if (c.req.header("Upgrade")) {
      return await next();
    }
    return c.html(
      <>
        <h1>使用 DevTools 调试 WebSocket 连接情况</h1>
        <pre id="output"></pre>
        <p>
          你按下了 <kbd id="keyEl">&nbsp;</kbd> 键
        </p>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.addEventListener('keypress', (e) => { console.log(e.code); keyEl.innerHTML = e.code; })`,
          }}
        ></script>
      </>,
    );
  })
  .get(
    "/sync.magic",
    upgradeWebSocket((c: Context<AppEnv>) => {
      return {
        async onOpen(e, ws) {
          log.i("client open");
        },
        async onMessage(e, ws) {
          if (typeof e.data == "string") {
            const action = JSON.parse(e.data);
            log.i("received %o", action);
            if (action.type == "register") {
              const { uid, email } = action.payload;
              const existed = await db.user.findFirst({
                where: {
                  OR: [{ uid }, { email }],
                },
              });

              if (existed) {
                log.w("user existed %o", existed);
              } else {
                const user = await db.user.create({
                  data: {
                    uid: "admin",
                    name: "admin",
                    email: "admin@example.com",
                    ...(action.payload ?? {}),
                  },
                });

                log.i("created user: %o", user);
              }
            }
          }
        },
      };
    }),
  );

export default app;

export type App = typeof app;
