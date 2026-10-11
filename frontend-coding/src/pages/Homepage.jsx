import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router';
import { useSelector } from 'react-redux';
import { Search, CheckCircle2, Circle, Swords, ArrowRight, Trophy, Inbox } from 'lucide-react';
import axiosClient from '../utils/axiosClient';
import Navbar from '../components/Navbar';

const DIFFICULTIES = ['easy', 'medium', 'hard'];
const TAGS = [
  { value: 'array', label: 'Array' },
  { value: 'linkedList', label: 'Linked List' },
  { value: 'graph', label: 'Graph' },
  { value: 'dp', label: 'DP' },
];
const tagLabel = (value) => TAGS.find((t) => t.value === value)?.label ?? value;
const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

function StatCard({ label, solved, total, colorClass, barClass }) {
  const pct = total ? Math.round((solved / total) * 100) : 0;
  return (
    <div className="glass-panel rounded-2xl p-5">
      <p className={`text-sm font-medium ${colorClass}`}>{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums">
        {solved}
        <span className="text-base font-medium text-base-content/40"> / {total}</span>
      </p>
      <div className="mt-3 h-1.5 rounded-full bg-base-300 overflow-hidden">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Homepage() {
  const { user } = useSelector((state) => state.auth);
  const [problems, setProblems] = useState([]);
  const [solvedProblems, setSolvedProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({ difficulty: 'all', tag: 'all', status: 'all' });

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      try {
        const [all, solved] = await Promise.all([
          axiosClient.get('/problem/getAllProblem'),
          axiosClient.get('/problem/problemSolvedByUser'),
        ]);
        setProblems(Array.isArray(all.data) ? all.data : []);
        setSolvedProblems(Array.isArray(solved.data) ? solved.data : []);
        setLoadError(null);
      } catch (error) {
        console.error('Error fetching problems:', error);
        setLoadError('Could not load problems. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const solvedIds = useMemo(() => new Set(solvedProblems.map((p) => p._id)), [solvedProblems]);

  const stats = useMemo(() => {
    const byDifficulty = Object.fromEntries(DIFFICULTIES.map((d) => [d, { solved: 0, total: 0 }]));
    for (const p of problems) {
      const bucket = byDifficulty[p.difficulty?.toLowerCase()];
      if (!bucket) continue;
      bucket.total++;
      if (solvedIds.has(p._id)) bucket.solved++;
    }
    return byDifficulty;
  }, [problems, solvedIds]);

  const filteredProblems = problems.filter((problem) => {
    const difficultyMatch = filters.difficulty === 'all' || problem.difficulty === filters.difficulty;
    const tagMatch = filters.tag === 'all' || problem.tags === filters.tag;
    const isSolved = solvedIds.has(problem._id);
    const statusMatch =
      filters.status === 'all' || (filters.status === 'solved' ? isSolved : !isSolved);
    const searchMatch = problem.title.toLowerCase().includes(query.trim().toLowerCase());
    return difficultyMatch && tagMatch && statusMatch && searchMatch;
  });

  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const hasFilters = query || filters.difficulty !== 'all' || filters.tag !== 'all' || filters.status !== 'all';

  return (
    <div className="min-h-screen bg-grid">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-10">
        {/* Hero */}
        <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr] items-stretch fade-up">
          <div className="glass-panel rounded-3xl p-8 flex flex-col justify-between">
            <div>
              <p className="text-sm font-medium text-accent">Welcome back</p>
              <h1 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight">
                Hey {user?.firstName}, ready to <span className="text-gradient">level up?</span>
              </h1>
              <p className="mt-3 text-base-content/60 max-w-xl">
                You have solved <span className="font-semibold text-base-content">{solvedIds.size}</span> of{' '}
                <span className="font-semibold text-base-content">{problems.length}</span> problems. Pick one below or
                challenge someone to a live battle.
              </p>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <NavLink to="/battle" className="btn-gradient">
                <Swords size={18} /> Start a 1v1 battle
              </NavLink>
              <a href="#problems" className="btn btn-ghost border border-base-content/15">
                Browse problems <ArrowRight size={16} />
              </a>
            </div>
          </div>

          <div className="grid grid-cols-3 lg:grid-cols-1 gap-4">
            <StatCard label="Easy" {...stats.easy} colorClass="difficulty-easy" barClass="bg-success" />
            <StatCard label="Medium" {...stats.medium} colorClass="difficulty-medium" barClass="bg-warning" />
            <StatCard label="Hard" {...stats.hard} colorClass="difficulty-hard" barClass="bg-error" />
          </div>
        </section>

        {/* Problem list */}
        <section id="problems" className="mt-12 scroll-mt-24">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Problems</h2>
              <p className="text-sm text-base-content/60">
                {filteredProblems.length} of {problems.length} shown
              </p>
            </div>

            <label className="input w-full md:w-80">
              <Search size={16} className="opacity-50" />
              <input
                type="search"
                placeholder="Search problems"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </div>

          {/* Filters */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <div className="join" role="group" aria-label="Status filter">
              {[
                ['all', 'All'],
                ['solved', 'Solved'],
                ['unsolved', 'Unsolved'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={`join-item btn btn-sm ${filters.status === value ? 'btn-primary' : 'btn-ghost border-base-content/10'}`}
                  onClick={() => setFilter('status', value)}
                >
                  {label}
                </button>
              ))}
            </div>

            <select
              className="select select-sm w-auto"
              value={filters.difficulty}
              onChange={(e) => setFilter('difficulty', e.target.value)}
              aria-label="Difficulty filter"
            >
              <option value="all">All difficulties</option>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>{capitalize(d)}</option>
              ))}
            </select>

            <select
              className="select select-sm w-auto"
              value={filters.tag}
              onChange={(e) => setFilter('tag', e.target.value)}
              aria-label="Topic filter"
            >
              <option value="all">All topics</option>
              {TAGS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>

            {hasFilters && (
              <button
                className="btn btn-sm btn-link text-base-content/60"
                onClick={() => {
                  setQuery('');
                  setFilters({ difficulty: 'all', tag: 'all', status: 'all' });
                }}
              >
                Clear filters
              </button>
            )}
          </div>

          <div className="mt-5 glass-panel rounded-2xl overflow-hidden">
            {loading ? (
              <div className="divide-y divide-base-content/5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-4">
                    <div className="skeleton w-5 h-5 rounded-full" />
                    <div className="skeleton h-4 flex-1 max-w-sm" />
                    <div className="skeleton h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : loadError ? (
              <div className="p-10 text-center text-error">{loadError}</div>
            ) : filteredProblems.length === 0 ? (
              <div className="p-12 text-center">
                <Inbox className="mx-auto text-base-content/30" size={40} />
                <p className="mt-3 font-medium">
                  {problems.length === 0 ? 'No problems yet' : 'No problems match your filters'}
                </p>
                <p className="text-sm text-base-content/50">
                  {problems.length === 0 ? 'Check back soon for new challenges.' : 'Try clearing the filters.'}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-base-content/5">
                {filteredProblems.map((problem, index) => {
                  const solved = solvedIds.has(problem._id);
                  return (
                    <li key={problem._id}>
                      <NavLink
                        to={`/problem/${problem._id}`}
                        className="group flex items-center gap-4 px-5 py-4 hover:bg-base-300/40 transition-colors"
                      >
                        {solved ? (
                          <CheckCircle2 size={20} className="text-success shrink-0" aria-label="Solved" />
                        ) : (
                          <Circle size={20} className="text-base-content/20 shrink-0" aria-label="Not solved" />
                        )}
                        <span className="text-sm text-base-content/40 tabular-nums w-6">{index + 1}</span>
                        <span className="flex-1 font-medium group-hover:text-primary transition-colors truncate">
                          {problem.title}
                        </span>
                        <span className="hidden sm:inline-flex badge badge-ghost badge-sm">{tagLabel(problem.tags)}</span>
                        <span className={`text-sm font-semibold w-16 text-right difficulty-${problem.difficulty?.toLowerCase()}`}>
                          {capitalize(problem.difficulty)}
                        </span>
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {!loading && solvedIds.size > 0 && solvedIds.size === problems.length && (
            <div className="mt-6 alert alert-success alert-soft">
              <Trophy size={18} /> You have solved every problem. Time to battle!
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default Homepage;
