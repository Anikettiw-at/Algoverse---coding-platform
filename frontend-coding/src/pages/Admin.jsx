import { NavLink } from 'react-router';
import { Plus, Pencil, Trash2, Video, ArrowRight } from 'lucide-react';

const adminOptions = [
  {
    title: 'Create Problem',
    description: 'Add a new problem with test cases, starter code and reference solutions.',
    icon: Plus,
    tone: 'text-success bg-success/10',
    route: '/admin/create',
  },
  {
    title: 'Update Problem',
    description: 'Edit an existing problem. Reference solutions are re-validated on save.',
    icon: Pencil,
    tone: 'text-warning bg-warning/10',
    route: '/admin/update',
  },
  {
    title: 'Delete Problem',
    description: 'Remove a problem along with its submissions.',
    icon: Trash2,
    tone: 'text-error bg-error/10',
    route: '/admin/delete',
  },
  {
    title: 'Video Editorials',
    description: 'Upload or remove solution walkthrough videos.',
    icon: Video,
    tone: 'text-info bg-info/10',
    route: '/admin/video',
  },
];

function Admin() {
  return (
    <div className="fade-up">
      <div className="mb-10">
        <p className="text-sm font-medium text-accent">Admin</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Manage AlgoVerse</h1>
        <p className="mt-2 text-base-content/60">Create, edit and curate the problems on the platform.</p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {adminOptions.map((option) => {
          const { title, description, icon: Icon, tone, route } = option;
          return (
          <NavLink
            key={route}
            to={route}
            className="group glass-panel rounded-2xl p-6 flex items-start gap-5 hover:-translate-y-0.5 hover:border-primary/40 transition-all"
          >
            <span className={`p-3 rounded-xl ${tone}`}>
              <Icon size={24} />
            </span>
            <span className="flex-1">
              <span className="flex items-center gap-2 text-lg font-semibold">
                {title}
                <ArrowRight size={16} className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
              </span>
              <span className="mt-1 block text-sm text-base-content/60">{description}</span>
            </span>
          </NavLink>
        );
            })}
      </div>
    </div>
  );
}

export default Admin;
