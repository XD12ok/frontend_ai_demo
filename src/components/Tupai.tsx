import Image from "next/image";

type TupaiProps = {
  className?: string;
  priority?: boolean;
};

export default function Tupai({ className, priority }: TupaiProps) {
  return (
    <Image
      src="/tupai.png"
      alt="TupAI"
      width={1080}
      height={1350}
      priority={priority}
      className={className}
    />
  );
}
