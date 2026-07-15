export function UserMessage({ text }: { text: string }) {
  return (
    <div className="ml-auto flex max-w-[min(44rem,100%)] justify-end">
      <div className="min-w-0 rounded-md bg-[#444963] px-4 py-3 text-base leading-7 text-white shadow-sm [overflow-wrap:anywhere]">
        {text}
      </div>
    </div>
  );
}
