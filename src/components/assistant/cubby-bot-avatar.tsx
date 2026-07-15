import Image from "next/image";

export function CubbyBotAvatar({ size = "default" }: { size?: "default" | "large" }) {
  const dimensions =
    size === "large"
      ? {
          container: "h-16 w-16 rounded-[22px]",
          image: "h-12 w-12 rounded-[18px]",
          imageSize: 48,
        }
      : {
          container: "h-12 w-12 rounded-[18px]",
          image: "h-9 w-9 rounded-[14px]",
          imageSize: 36,
        };

  return (
    <div
      className={`flex shrink-0 items-center justify-center bg-white shadow-sm ring-1 ring-[#d6e4ef] ${dimensions.container}`}
    >
      <Image
        src="/cubby-smile.png"
        alt="CubbyBot"
        width={dimensions.imageSize}
        height={dimensions.imageSize}
        className={`object-cover ${dimensions.image}`}
      />
    </div>
  );
}
