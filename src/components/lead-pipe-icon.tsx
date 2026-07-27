type LeadPipeIconProps = {
  className?: string;
};

export default function LeadPipeIcon({ className = "" }: LeadPipeIconProps) {
  return (
    <svg
      aria-label="Lead pipe"
      className={className}
      fill="none"
      role="img"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 5h10v6h6v8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="4"
      />
    </svg>
  );
}
