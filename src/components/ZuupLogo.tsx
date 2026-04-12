export function ZuupLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <img
        src="https://www.zuup.dev/lovable-uploads/b44b8051-6117-4b37-999d-014c4c33dd13.png"
        alt="Zuup"
        className="h-14 w-auto"
      />
      <div className="flex items-center gap-1.5">
        <span className="text-xl font-bold tracking-tight text-foreground">Zuup</span>
        <span className="text-xl font-light tracking-tight text-primary">Auth</span>
      </div>
    </div>
  );
}
