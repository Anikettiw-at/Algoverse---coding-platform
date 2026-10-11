import { useEffect, useState } from 'react';
import { NavLink } from 'react-router'; // Fixed import
import { useDispatch, useSelector } from 'react-redux';
import axiosClient from '../utils/axiosClient';
import { logoutUser } from '../authSlice';

function Homepage() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const [problems, setProblems] = useState([]);
  const [solvedProblems, setSolvedProblems] = useState([]);
  const [filters, setFilters] = useState({
    difficulty: 'all',
    tag: 'all',
    status: 'all' 
  });

  useEffect(() => {
    const fetchProblems = async () => {
      try {
        const { data } = await axiosClient.get('/problem/getAllProblem');
        setProblems(data);
      } catch (error) {
        console.error('Error fetching problems:', error);
      }
    };

    const fetchSolvedProblems = async () => {
      try {
        const { data } = await axiosClient.get('/problem/problemSolvedByUser');
        setSolvedProblems(data);
      } catch (error) {
        console.error('Error fetching solved problems:', error);
      }
    };

    fetchProblems();
    if (user) fetchSolvedProblems();
  }, [user]);

  const handleLogout = () => {
    dispatch(logoutUser());
    setSolvedProblems([]); // Clear solved problems on logout
  };

  const filteredProblems = problems.filter(problem => {
    const difficultyMatch = filters.difficulty === 'all' || problem.difficulty === filters.difficulty;
    const tagMatch = filters.tag === 'all' || problem.tags === filters.tag;
    const statusMatch = filters.status === 'all' || 
                        solvedProblems.some(sp => sp._id === problem._id);
    return difficultyMatch && tagMatch && statusMatch;
  });

  return (
    <div className="home-bg">

      {/* NAVBAR */}
      <nav className="navbar cyber-nav px-6 flex justify-between items-center">
        <div className="flex-1">
          <NavLink to="/" className="brand-title">
            AlgoVerse
          </NavLink>
        </div>

        <div className="flex-none flex items-center gap-4">
          {/* ⚔️ 1v1 Battle Button */}
          <NavLink 
            to="/battle" 
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-md hover:shadow-indigo-500/50 transition-all flex items-center gap-2 border border-indigo-400/30"
          >
            ⚔️ 1v1 Battle
          </NavLink>

          {/* User Profile Dropdown */}
          <div className="dropdown dropdown-end">
            <div tabIndex={0} className="btn btn-ghost text-cyan-400">
              {user?.firstName}
            </div>
            <ul className="mt-3 p-2 shadow menu menu-sm dropdown-content bg-base-100 rounded-box w-52 z-[50]">
              <li><button onClick={handleLogout}>Logout</button></li>
              {user?.role === "admin" && (
                <li><NavLink to="/admin">Admin</NavLink></li>
              )}
            </ul>
          </div>
        </div>
      </nav>

      {/* CONTENT */}
      <div className="container mx-auto p-6">

        {/* FILTERS */}
        <div className="filter-box flex flex-wrap gap-4 mb-8">
          <select
            className="select select-bordered"
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="all">All Problems</option>
            <option value="solved">Solved</option>
          </select>

          <select
            className="select select-bordered"
            value={filters.difficulty}
            onChange={(e) => setFilters({ ...filters, difficulty: e.target.value })}
          >
            <option value="all">Difficulty</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>

          <select
            className="select select-bordered"
            value={filters.tag}
            onChange={(e) => setFilters({ ...filters, tag: e.target.value })}
          >
            <option value="all">Tags</option>
            <option value="array">Array</option>
            <option value="linkedList">Linked List</option>
            <option value="graph">Graph</option>
            <option value="dp">DP</option>
          </select>
        </div>

        {/* PROBLEMS */}
        <div className="grid gap-6">
          {filteredProblems.map((problem) => {
            const solved = solvedProblems.some(sp => sp._id === problem._id);

            return (
              <div key={problem._id} className="problem-card p-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold">
                    <NavLink to={`/problem/${problem._id}`} className="hover:text-cyan-400">
                      {problem.title}
                    </NavLink>
                  </h2>

                  {solved && (
                    <div className="badge badge-success solved-glow">
                      ✔ Solved
                    </div>
                  )}
                </div>

                <div className="flex gap-3 mt-4">
                  <span className={`badge ${getDifficultyBadgeColor(problem.difficulty)}`}>
                    {problem.difficulty}
                  </span>
                  <span className="badge badge-info">
                    {problem.tags}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const getDifficultyBadgeColor = (difficulty) => {
  switch (difficulty?.toLowerCase()) {
    case 'easy': return 'badge-success';
    case 'medium': return 'badge-warning';
    case 'hard': return 'badge-error';
    default: return 'badge-neutral';
  }
};

export default Homepage;