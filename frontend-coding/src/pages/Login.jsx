import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, NavLink } from 'react-router';
import { useEffect, useState } from 'react';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { loginUser } from '../authSlice';
import AuthLayout, { FormField } from '../components/AuthLayout';

const loginSchema = z.object({
  emailId: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, loading, error } = useSelector((state) => state.auth);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: zodResolver(loginSchema) });

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const onSubmit = (data) => {
    dispatch(loginUser(data));
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to continue your practice streak."
      footer={
        <>
          New to AlgoVerse?{' '}
          <NavLink to="/signup" className="font-semibold text-primary hover:underline">
            Create an account
          </NavLink>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
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
              placeholder="Your password"
              autoComplete="current-password"
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

        {error && (
          <div role="alert" className="alert alert-error alert-soft text-sm py-2.5">
            {error}
          </div>
        )}

        <button type="submit" className="btn-gradient w-full" disabled={loading}>
          {loading && <span className="loading loading-spinner loading-sm" />}
          {loading ? 'Logging in...' : 'Log in'}
        </button>
      </form>
    </AuthLayout>
  );
}

export default Login;
