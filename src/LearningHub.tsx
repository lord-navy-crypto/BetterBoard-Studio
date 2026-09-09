import {
  ArrowRight, BookOpen, CircleAlert, Gauge, Lightbulb, Magnet, Microscope,
  Ruler, Sigma, Waves,
} from 'lucide-react';

type LearningTrack = {
  title: string;
  subtitle: string;
  icon: typeof Sigma;
  concepts: Array<{ name: string; detail: string; equation?: string }>;
  question: string;
  experiment: 'numerical' | 'magnet';
  action: string;
};

type Props = {
  onOpenExperiment: (domain: 'numerical' | 'magnet') => void;
};

const TRACKS: LearningTrack[] = [
  {
    title: 'Numerical Error',
    subtitle: 'finite arithmetic · discretization · stability',
    icon: Sigma,
    concepts: [
      { name: 'Roundoff', detail: 'Finite floating-point representation changes arithmetic.', equation: 'fl(x) = x(1 + δ)' },
      { name: 'Truncation', detail: 'A finite approximation replaces an infinite or continuous process.', equation: "f'(x) ≈ [f(x+h)-f(x)]/h" },
      { name: 'Cancellation', detail: 'Subtracting nearly equal values can destroy significant digits.' },
      { name: 'Convergence', detail: 'Smaller steps do not guarantee better answers forever.' },
    ],
    question: 'Why can a mathematically better approximation become numerically worse on a real microcontroller?',
    experiment: 'numerical',
    action: 'Open Numerical Analysis',
  },
  {
    title: 'Sampling & Measurement',
    subtitle: 'ADC · timing · noise · reconstruction',
    icon: Waves,
    concepts: [
      { name: 'Sampling', detail: 'A continuous process becomes a finite sequence of observations.', equation: 'x(t) → x[n]' },
      { name: 'Quantization', detail: 'Finite ADC codes replace a continuous input range.' },
      { name: 'Differentiation noise', detail: 'Small sample-to-sample variation can dominate a derivative.', equation: 'dx/dt ≈ Δx/Δt' },
      { name: 'Repeatability', detail: 'Repeated measurements expose spread without pretending to know absolute truth.' },
    ],
    question: 'How much of an observed discrepancy came from the sensor, the sample clock, and the numerical method?',
    experiment: 'numerical',
    action: 'Open Sampling Bench',
  },
  {
    title: 'Magnetism & Model Validation',
    subtitle: 'field acquisition · residuals · validation',
    icon: Magnet,
    concepts: [
      { name: 'Vector field', detail: 'A three-axis sensor measures components that can be compared independently or as magnitude.', equation: '|B| = √(Bx²+By²+Bz²)' },
      { name: 'Baseline', detail: 'Ambient field is evidence that should be measured, not silently assumed away.' },
      { name: 'Residual', detail: 'Model disagreement is spatial evidence, not just one RMSE number.', equation: 'r(x) = Bmeas(x) - Bmodel(x)' },
      { name: 'Model error', detail: 'A model can be internally precise while still disagreeing with the physical system.' },
    ],
    question: 'Where does a magnetic model disagree with measurement, and is that disagreement systematic?',
    experiment: 'magnet',
    action: 'Open Magnet Lab',
  },
  {
    title: 'Verification & Validation',
    subtitle: 'measurement · numerical · model uncertainty',
    icon: Microscope,
    concepts: [
      { name: 'Verification', detail: 'Did we solve or implement the intended equations correctly?' },
      { name: 'Validation', detail: 'Does the model represent the physical system well enough for the question?' },
      { name: 'Scientific boundary', detail: 'A serial number is evidence, not automatic proof of calibration or truth.' },
      { name: 'Error budget', detail: 'Observed discrepancy can contain measurement, numerical and model contributions.' },
    ],
    question: 'When a prediction and a measurement differ, what kind of error are we actually looking at?',
    experiment: 'magnet',
    action: 'Open Validation Workflow',
  },
];

export default function LearningHub({ onOpenExperiment }: Props) {
  return <div className="learning-workspace">
    <section className="learning-hero">
      <div>
        <div className="eyebrow">Learning</div>
        <h1>Understand the number before trusting the number.</h1>
        <p>Concepts in BetterBoard are tied to runnable experiments. Learn the idea, change one variable, observe the evidence, then explain the discrepancy.</p>
      </div>
      <div className="learning-loop"><BookOpen size={18}/><b>Concept</b><ArrowRight size={14}/><b>Experiment</b><ArrowRight size={14}/><b>Evidence</b><ArrowRight size={14}/><b>Interpretation</b></div>
    </section>

    <section className="learning-principles">
      <div><Gauge size={17}/><b>Measurement error</b><span>noise · bias · calibration · resolution</span></div>
      <div><Sigma size={17}/><b>Numerical error</b><span>roundoff · truncation · discretization · stability</span></div>
      <div><Ruler size={17}/><b>Model error</b><span>assumptions · parameters · missing physics</span></div>
    </section>

    <section className="learning-grid">
      {TRACKS.map(track => {
        const Icon = track.icon;
        return <article className="panel learning-track" key={track.title}>
          <div className="learning-track-head"><span><Icon size={18}/></span><div><b>{track.title}</b><small>{track.subtitle}</small></div></div>
          <div className="learning-concepts">
            {track.concepts.map(concept => <div key={concept.name}>
              <b>{concept.name}</b>
              <p>{concept.detail}</p>
              {concept.equation && <code>{concept.equation}</code>}
            </div>)}
          </div>
          <div className="learning-question"><Lightbulb size={15}/><span>{track.question}</span></div>
          <button className="primary" onClick={() => onOpenExperiment(track.experiment)}>{track.action}<ArrowRight size={14}/></button>
        </article>;
      })}
    </section>

    <section className="panel learning-boundary">
      <CircleAlert size={17}/>
      <div><b>Keep the error categories separate.</b><p>BetterBoard should help you compare them, not collapse them into one vague “error” number. Measurement uncertainty, numerical approximation and model discrepancy can interact, but they are different scientific questions.</p></div>
    </section>
  </div>;
}
