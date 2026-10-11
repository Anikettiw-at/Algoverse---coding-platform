import "./App.css";
import { Routes, Route, Navigate } from "react-router";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Homepage from "./pages/Homepage";
import { useDispatch, useSelector } from 'react-redux';
import { checkAuth } from "./authSlice";
import { useEffect, useState, lazy, Suspense } from "react";
import Navbar, { Logo } from "./components/Navbar";
const AdminPanel = lazy(() => import("./components/AdminPanel"));
const ProblemPage = lazy(() => import("./pages/ProblemPage"));
const Admin = lazy(() => import("./pages/Admin"));
const AdminVideo = lazy(() => import("./components/AdminVideo"));
const AdminDelete = lazy(() => import("./components/AdminDelete"));
const AdminUpload = lazy(() => import("./components/AdminUpload"));
const AdminUpdate = lazy(() => import("./components/AdminUpdate"));
const CodeBattle = lazy(() => import("./pages/CodeBattle"));

// Heavy pages (Monaco editor, admin tools) alag chunks me load hote hain
function PageLoader() {
  return (
    <div className="min-h-screen grid place-items-center bg-base-200">
      <span className="loading loading-dots loading-md text-primary"></span>
    </div>
  );
}

// Admin pages ke upar common navbar + page container
function AppShell({ children }) {
  return (
    <div className="min-h-screen bg-grid">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}

function App() {
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useSelector((state) => state.auth);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    dispatch(checkAuth()).finally(() => setAuthChecked(true));
  }, [dispatch]);

  // Sirf pehli baar session check hone tak loader dikhao. Login/signup ke dauraan
  // `loading` true hota hai — tab form unmount nahi hona chahiye.
  if (!authChecked) {
    return (
      <div className="min-h-screen grid place-items-center bg-grid">
        <div className="flex flex-col items-center gap-5">
          <Logo size="lg" />
          <span className="loading loading-dots loading-md text-primary"></span>
        </div>
      </div>
    );
  }

  const isAdmin = isAuthenticated && user?.role === 'admin';
  const admin = (element) => (isAdmin ? <AppShell>{element}</AppShell> : <Navigate to="/" />);

  return (
    <>
      <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={isAuthenticated ? <Homepage /> : <Navigate to="/login" />} />
        <Route path="/login" element={isAuthenticated ? <Navigate to="/" /> : <Login />} />
        <Route path="/signup" element={isAuthenticated ? <Navigate to="/" /> : <Signup />} />

        {/* ⚔️ 1v1 Battle Route */}
        <Route path="/battle" element={isAuthenticated ? <CodeBattle /> : <Navigate to="/login" />} />

        {/* Admin Routes */}
        <Route path="/admin" element={admin(<Admin />)} />
        <Route path="/admin/create" element={admin(<AdminPanel />)} />
        <Route path="/admin/update" element={admin(<AdminUpdate />)} />
        <Route path="/admin/update/:problemId" element={admin(<AdminPanel />)} />
        <Route path="/admin/delete" element={admin(<AdminDelete />)} />
        <Route path="/admin/video" element={admin(<AdminVideo />)} />
        <Route path="/admin/upload/:problemId" element={admin(<AdminUpload />)} />

        {/* Problem Route */}
        <Route path="/problem/:problemId" element={isAuthenticated ? <ProblemPage /> : <Navigate to="/login" />} />

        {/* Unknown routes */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      </Suspense>
    </>
  );
}

export default App;