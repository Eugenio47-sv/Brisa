import bcrypt from "bcrypt";
import { passwordSchema } from "../src/modules/auth.js";
if (!process.stdin.isTTY) {
  console.error(
    "Ejecuta este comando en una terminal interactiva. La contraseña no se acepta como argumento.",
  );
  process.exit(1);
}
process.stdout.write(
  "Nueva contraseña (entrada oculta, mínimo 12 caracteres): ",
);
process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding("utf8");
let password = "";
process.stdin.on("data", async (chunk) => {
  for (const ch of chunk) {
    if (ch === "\u0003") {
      process.stdin.setRawMode(false);
      process.exit(1);
    }
    if (ch === "\r" || ch === "\n") {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
      const parsed = passwordSchema.safeParse(password);
      if (!parsed.success) {
        console.error(parsed.error.issues[0].message);
        process.exit(1);
      }
      console.log(await bcrypt.hash(password, 12));
      return;
    }
    if (ch === "\u007f" || ch === "\b") password = password.slice(0, -1);
    else password += ch;
  }
});
