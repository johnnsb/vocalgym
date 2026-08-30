import FeedbackSections from "./FeedbackSections";

interface Props {
  feedback: string;
}

export default function PracticeFeedback({ feedback }: Props) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
      <h2 className="mb-5 text-lg font-semibold">Coaching notes</h2>
      <FeedbackSections feedback={feedback} />
    </section>
  );
}
