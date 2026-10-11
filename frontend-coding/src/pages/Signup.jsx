import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, NavLink } from 'react-router';
import { Eye, EyeOff, Mail, Lock, User, Check } from 'lucide-react';
import { registerUser } from '../authSlice';
import AuthLayout, { FormField } from '../components/AuthLayout';

// Backend ke validator.isStrongPassword ke rules se match karta hai
const passwordRules = [
  { test: (v) => v.length >= 8, label: '8+ characters' },
  { test: (v) => /[a-z]/.test(v), label: 'Lowercase' },
  { test: (v) => /[A-Z]/.test(v), label: 'Uppercase' },
  { test: (v) => /[0-9]/.test(v), label: 'Number' },
  { test: (v) => /[^A-Za-z0-9]/.test(v), label: 'Symbol' },
];

const signupSchema = z.object({
  firstName: z.string().min(3, 'Name must be at least 3 characters').max(20, 'Name must be at most 20 characters'),
  emailId: z.string().email('Enter a valid email'),
  password: z.string().refine((v) => passwordRules.every((rule) => rule.test(v)), 'Password does not meet all the rules'),
});

function Signup() {
  const [showPassword, setShowPassword] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, loading, error } = useSelector((state) => state.auth);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm({ resolver: zodResolver(signupSchema), defaultValues: { password: '' } });

  const password = watch('password') ?? '';

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const onSubmit = (data) => {
    dispatch(registerUser(data));
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start solving problems in under a minute."
      footer={
        <>
          Already have an account?{' '}
          <NavLink to="/login" className="font-semibold text-primary hover:underline">
            Log in
          </NavLink>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        <FormField label="First name" error={errors.firstName?.message}>
          <span className={`input w-full ${errors.firstName ? 'input-error' : ''}`}>
            <User size={16} className="opacity-50" />
            <input type="text" placeholder="Aniket" autoComplete="given-name" {...register('firstName')} />
          </span>
        </FormField>

        <FormField label="Email" error={errors.emailId?.message}>
          <span className={`input w-full ${errors.emailId ? 'input-error' : ''}`}>
            <Mail size={16} className="opacity-50" />
            <input type="email" placeholder="you@example.com" autoComplete="email" {...register('emailId')} />
          </span>
        </FormField>

        <FormField label="Password" error={errors.password?.message}>
          <span className={`input w-full ${errors.password ? 'input-error' : ''}`}>
            <Lock size={16} className="opacity-50" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Create a strong password"
              autoComplete="new-password"
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="opacity-60 hover:opacity-100"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </span>
        </FormField>

        {/* Live password checklist */}
        <ul className="flex flex-wrap gap-2" aria-label="Password requirements">
          {passwordRules.map((rule) => {
            const ok = rule.test(password);
            return (
              <li
                key={rule.label}
                className={`badge badge-sm gap-1 ${ok ? 'badge-success badge-soft' : 'badge-ghost text-base-content/50'}`}
              >
                {ok && <Check size={12} />}
                {rule.label}
              </li>
            );
          })}
        </ul>

        {error && (
          <div role="alert" className="alert alert-error alert-soft text-sm py-2.5">
            {error}
          </div>
        )}

        <button type="submit" className="btn-gradient w-full" disabled={loading}>
          {loading && <span className="loading loading-spinner loading-sm" />}
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>
    </AuthLayout>
  );
}

export default Signup;
