export default function NumberInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className="w-16 text-center border rounded" type="number" {...props} />;
}