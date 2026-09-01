import FeedbackSections from "./FeedbackSections";
import { Card } from "@/components/ui";

interface Props {
  feedback: string;
}

export default function PracticeFeedback({ feedback }: Props) {
  return (
    <Card padding="lg">
      <h2 className="mb-5 text-h4 text-text-primary">Coaching notes</h2>
      <FeedbackSections feedback={feedback} />
    </Card>
  );
}
