import { Bot, Swords, Gauge, PlayCircle } from 'lucide-react';
import { Logo } from './Navbar';

const features = [
  { icon: Gauge, title: 'Real code judging', text: 'Run C++, Java and JavaScript against hidden test cases in a sandbox.' },
  { icon: Bot, title: 'AI DSA tutor', text: 'Hints, code reviews and complexity analysis for the problem you are on.' },
  { icon: Swords, title: 'Live 1v1 battles', text: 'Get matched with another coder and race to solve the same problem.' },
  { icon: PlayCircle, title: 'Video editorials', text: 'Step-by-step solution walkthroughs from the problem setters.' },
];

const sampleCode = `int twoSum(vector<int>& nums, int target) {
  unordered_map<int,int> seen;
  for (int i = 0; i < nums.size(); i++) {
    if (seen.count(target - nums[i]))
      return {seen[target - nums[i]], i};
    seen[nums[i]] = i;
  }
}`;

function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-screen bg-grid grid lg:grid-cols-2">
      {/* Brand panel */}
      <aside className="hidden lg:flex flex-col justify-between gap-10 p-12 xl:p-16">
        <Logo size="lg" />

        <div className="max-w-lg fade-up">
          <h1 className="text-5xl font-extrabold leading-tight tracking-tight">
            Code. Compete.
            <br />
            <span className="text-gradient">Conquer.</span>
          </h1>
          <p className="mt-5 text-lg text-base-content/70">
            Sharpen your problem-solving skills with real judging, an AI tutor and live battles.
          </p>

          <ul className="mt-10 grid grid-cols-2 gap-5">
            {features.map((feature) => {
              const { icon: Icon, title: featureTitle, text } = feature;
              return (
              <li key={featureTitle} className="glass-panel rounded-2xl p-4">
                <Icon className="text-accent" size={22} />
                <p className="mt-3 font-semibold">{featureTitle}</p>
                <p className="mt-1 text-sm text-base-content/60 leading-relaxed">{text}</p>
              </li>
            );
            })}
          </ul>
        </div>

        <pre className="hidden [@media(min-height:1000px)]:block glass-panel rounded-2xl p-5 text-xs leading-relaxed font-mono text-base-content/70 max-w-lg overflow-hidden" aria-hidden="true">
          <code>{sampleCode}</code>
        </pre>
      </aside>

      {/* Form panel */}
      <main className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md fade-up">
          <div className="lg:hidden mb-8 flex justify-center">
            <Logo size="lg" />
          </div>
          <div className="glass-panel rounded-3xl p-8 sm:p-10">
            <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
            <p className="mt-1.5 text-sm text-base-content/60">{subtitle}</p>
            <div className="mt-8">{children}</div>
          </div>
          {footer && <p className="mt-6 text-center text-sm text-base-content/60">{footer}</p>}
        </div>
      </main>
    </div>
  );
}

export function FormField({ label, error, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-base-content/80">{label}</span>
      {children}
      {error && <span className="mt-1.5 block text-xs text-error">{error}</span>}
    </label>
  );
}

export default AuthLayout;
