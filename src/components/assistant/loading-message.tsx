import { Loader2 } from "lucide-react";
import { CubbyBotAvatar } from "./cubby-bot-avatar";

export function LoadingMessage() {
  return (
    <div className="flex w-full max-w-5xl min-w-0 gap-3">
      <CubbyBotAvatar />
      <div className="relative min-w-0 flex-1 rounded-md border border-[#c9d9e6] bg-white px-4 py-3 shadow-sm before:absolute before:left-[-7px] before:top-5 before:h-3 before:w-3 before:rotate-45 before:border-b before:border-l before:border-[#c9d9e6] before:bg-white">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#eef7fc] text-[#4b9dcc]">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-[#444963]">
              Checking Cubby documentation
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
