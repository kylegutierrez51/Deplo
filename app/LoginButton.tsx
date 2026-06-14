import { login } from "@/lib/actions/auth";

export default function LoginButton() {
  return (
    <form action={login}>
      <button type="submit">Login</button>
    </form>
  );
}
