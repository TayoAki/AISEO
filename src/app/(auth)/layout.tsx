import { Logo } from "@/components/brand";

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-5 py-12">
      <Logo />
      <main className="w-full max-w-md">{children}</main>
    </div>
  );
}
