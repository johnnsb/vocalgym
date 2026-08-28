interface Props {
  feedback: string;
}

export default function PracticeFeedback({ feedback }: Props) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">Coaching notes</h2>
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
        {feedback}
      </div>
    </section>
  );
}
