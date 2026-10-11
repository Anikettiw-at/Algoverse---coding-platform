import { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { useParams, NavLink } from 'react-router';
import { ArrowLeft, Play, Send, FileText, Video as VideoIcon, Code2, History, Bot } from 'lucide-react';
import { Logo } from '../components/Navbar';
import axiosClient from "../utils/axiosClient"
import SubmissionHistory from "../components/SubmissionHistory"
import ChatAi from '../components/ChatAi';
import Editorial from '../components/Editorial';

const langMap = {
        cpp: 'C++',
        java: 'Java',
        javascript: 'JavaScript'
};

// Kisi language ka start code missing ho to crash na kare
const getInitialCode = (problem, language) =>
  problem?.startCode?.find(sc => sc.language === langMap[language])?.initialCode ?? '';

const getRequestError = (error) =>
  typeof error.response?.data === 'string' ? error.response.data : (error.response?.data?.message || error.message);


const ProblemPage = () => {
  const [problem, setProblem] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState('javascript');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [submitResult, setSubmitResult] = useState(null);
  const [activeLeftTab, setActiveLeftTab] = useState('description');
  const [activeRightTab, setActiveRightTab] = useState('code');
  const editorRef = useRef(null);
  let {problemId}  = useParams();




 useEffect(() => {
    const fetchProblem = async () => {
      setLoading(true);
      try {

        const response = await axiosClient.get(`/problem/problemById/${problemId}`);


        const initialCode = getInitialCode(response.data, selectedLanguage);

        setProblem(response.data);

        setCode(initialCode);
        setLoading(false);

      } catch (error) {
        console.error('Error fetching problem:', error);
        setLoading(false);
      }
    };

    fetchProblem();
  }, [problemId]); // eslint-disable-line react-hooks/exhaustive-deps -- language change alag effect handle karta hai

  // Update code when language changes
  useEffect(() => {
    if (problem) {
      setCode(getInitialCode(problem, selectedLanguage));
    }
  }, [selectedLanguage, problem]);

  const handleEditorChange = (value) => {
    setCode(value || '');
  };

  const handleEditorDidMount = (editor) => {
    editorRef.current = editor;
  };

  const handleLanguageChange = (language) => {
    setSelectedLanguage(language);
  };

  const handleRun = async () => {
    setLoading(true);
    setRunResult(null);

    try {
      const response = await axiosClient.post(`/submission/run/${problemId}`, {
        code,
        language: selectedLanguage
      });

      setRunResult(response.data);
      setLoading(false);
      setActiveRightTab('testcase');

    } catch (error) {
      console.error('Error running code:', error);
      setRunResult({
        success: false,
        testCases: [],
        error: getRequestError(error)
      });
      setLoading(false);
      setActiveRightTab('testcase');
    }
  };

  const handleSubmitCode = async () => {
    setLoading(true);
    setSubmitResult(null);

    try {
        const response = await axiosClient.post(`/submission/submit/${problemId}`, {
        code:code,
        language: selectedLanguage
      });

       setSubmitResult(response.data);
       setLoading(false);
       setActiveRightTab('result');

    } catch (error) {
      console.error('Error submitting code:', error);
      setSubmitResult({
        accepted: false,
        error: getRequestError(error),
        passedTestCases: 0,
        totalTestCases: 0
      });
      setLoading(false);
      setActiveRightTab('result');
    }
  };

  const getLanguageForMonaco = (lang) => {
    switch (lang) {
      case 'javascript': return 'javascript';
      case 'java': return 'java';
      case 'cpp': return 'cpp';
      default: return 'javascript';
    }
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'easy': return 'badge-success';
      case 'medium': return 'badge-warning';
      case 'hard': return 'badge-error';
      default: return 'badge-ghost';
    }
  };

  if (loading && !problem) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-base-200">
      {/* Top bar */}
      <header className="h-14 shrink-0 flex items-center justify-between gap-4 px-4 border-b border-base-content/10 bg-base-100">
        <div className="flex items-center gap-3 min-w-0">
          <NavLink to="/" className="btn btn-ghost btn-sm btn-square" aria-label="Back to problems">
            <ArrowLeft size={18} />
          </NavLink>
          <NavLink to="/" className="hidden sm:block"><Logo /></NavLink>
          <span className="hidden md:block text-base-content/30">/</span>
          <span className="truncate font-medium">{problem?.title ?? 'Loading...'}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button className="btn btn-sm btn-ghost border border-base-content/15" onClick={handleRun} disabled={loading}>
            {loading ? <span className="loading loading-spinner loading-xs" /> : <Play size={14} />} Run
          </button>
          <button className="btn btn-sm btn-success" onClick={handleSubmitCode} disabled={loading}>
            {loading ? <span className="loading loading-spinner loading-xs" /> : <Send size={14} />} Submit
          </button>
        </div>
      </header>

    <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
      {/* Left Panel */}
      <div className="lg:w-1/2 min-h-0 h-1/2 lg:h-auto flex flex-col border-b lg:border-b-0 lg:border-r border-base-content/10 bg-base-100">
        {/* Left Tabs */}
        <div className="tabs tabs-border bg-base-100 px-2 border-b border-base-content/10 shrink-0">
          <button
            className={`tab gap-1.5 text-sm ${activeLeftTab === 'description' ? 'tab-active' : ''}`}
            onClick={() => setActiveLeftTab('description')}
          >
            <FileText size={15} /> Description
          </button>
          <button
            className={`tab gap-1.5 text-sm ${activeLeftTab === 'editorial' ? 'tab-active' : ''}`}
            onClick={() => setActiveLeftTab('editorial')}
          >
            <VideoIcon size={15} /> Editorial
          </button>
          <button
            className={`tab gap-1.5 text-sm ${activeLeftTab === 'solutions' ? 'tab-active' : ''}`}
            onClick={() => setActiveLeftTab('solutions')}
          >
            <Code2 size={15} /> Solutions
          </button>
          <button
            className={`tab gap-1.5 text-sm ${activeLeftTab === 'submissions' ? 'tab-active' : ''}`}
            onClick={() => setActiveLeftTab('submissions')}
          >
            <History size={15} /> Submissions
          </button>

          <button
            className={`tab gap-1.5 text-sm ${activeLeftTab === 'chatAI' ? 'tab-active' : ''}`}
            onClick={() => setActiveLeftTab('chatAI')}
          >
            <Bot size={15} /> AI Tutor
          </button>


        </div>

        {/* Left Content */}
        <div className="flex-1 overflow-y-auto scroll-thin p-6">
          {problem && (
            <>
              {activeLeftTab === 'description' && (
                <div>
                  <div className="flex items-center gap-4 mb-6">
                    <h1 className="text-2xl font-bold">{problem.title}</h1>
                    <div className={`badge badge-soft ${getDifficultyColor(problem.difficulty)}`}>
                      {problem.difficulty.charAt(0).toUpperCase() + problem.difficulty.slice(1)}
                    </div>
                    <div className="badge badge-ghost">{problem.tags}</div>
                  </div>

                  <div className="prose max-w-none">
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {problem.description}
                    </div>
                  </div>

                  <div className="mt-8">
                    <h3 className="text-lg font-semibold mb-4">Examples:</h3>
                    <div className="space-y-4">
                      {problem.visibleTestCases.map((example, index) => (
                        <div key={index} className="bg-base-200 border border-base-content/10 p-4 rounded-xl">
                          <h4 className="font-semibold mb-2">Example {index + 1}:</h4>
                          <div className="space-y-2 text-sm font-mono whitespace-pre-wrap break-words">
                            <div><strong>Input:</strong> {example.input}</div>
                            <div><strong>Output:</strong> {example.output}</div>
                            <div><strong>Explanation:</strong> {example.explanation}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeLeftTab === 'editorial' && (
                <div className="prose max-w-none">
                  <h2 className="text-xl font-bold mb-4">Editorial</h2>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {problem.secureUrl ? (
                      <Editorial secureUrl={problem.secureUrl} thumbnailUrl={problem.thumbnailUrl} duration={problem.duration}/>
                    ) : (
                      <p className="text-base-content/50">No video editorial for this problem yet.</p>
                    )}
                  </div>
                </div>
              )}

              {activeLeftTab === 'solutions' && (
                <div>
                  <h2 className="text-xl font-bold mb-4">Solutions</h2>
                  <div className="space-y-6">
                    {problem.referenceSolution?.length ? problem.referenceSolution.map((solution, index) => (
                      <div key={index} className="border border-base-300 rounded-lg">
                        <div className="bg-base-200 px-4 py-2 rounded-t-lg">
                          <h3 className="font-semibold">{problem?.title} - {solution?.language}</h3>
                        </div>
                        <div className="p-4">
                          <pre className="bg-base-300 p-4 rounded text-sm overflow-x-auto">
                            <code>{solution?.completeCode}</code>
                          </pre>
                        </div>
                      </div>
                    )) : <p className="text-base-content/50">No solutions available yet.</p>}
                  </div>
                </div>
              )}

              {activeLeftTab === 'submissions' && (
                <div>
                  <h2 className="text-xl font-bold mb-4">My Submissions</h2>
                  <div>
                    <SubmissionHistory problemId={problemId} />
                  </div>
                </div>
              )}

              {activeLeftTab === 'chatAI' && (
                <div className="prose max-w-none">
                  <h2 className="text-xl font-bold mb-4">AI Tutor</h2>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    <ChatAi problem={problem}></ChatAi>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right Panel */}
      <div className="lg:w-1/2 min-h-0 h-1/2 lg:h-auto flex flex-col bg-base-100">
        {/* Right Tabs */}
        <div className="tabs tabs-border bg-base-100 px-2 border-b border-base-content/10 shrink-0">
          <button
            className={`tab gap-1.5 text-sm ${activeRightTab === 'code' ? 'tab-active' : ''}`}
            onClick={() => setActiveRightTab('code')}
          >
            Code
          </button>
          <button
            className={`tab gap-1.5 text-sm ${activeRightTab === 'testcase' ? 'tab-active' : ''}`}
            onClick={() => setActiveRightTab('testcase')}
          >
            Testcase
          </button>
          <button
            className={`tab gap-1.5 text-sm ${activeRightTab === 'result' ? 'tab-active' : ''}`}
            onClick={() => setActiveRightTab('result')}
          >
            Result
          </button>
        </div>

        {/* Right Content */}
        <div className="flex-1 flex flex-col">
          {activeRightTab === 'code' && (
            <div className="flex-1 flex flex-col">
              {/* Language Selector */}
              <div className="flex justify-between items-center p-4 border-b border-base-300">
                <div className="flex gap-2">
                  {['javascript', 'java', 'cpp'].map((lang) => (
                    <button
                      key={lang}
                      className={`btn btn-sm ${selectedLanguage === lang ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => handleLanguageChange(lang)}
                    >
                      {lang === 'cpp' ? 'C++' : lang === 'javascript' ? 'JavaScript' : 'Java'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Monaco Editor */}
              <div className="flex-1">
                <Editor
                  height="100%"
                  language={getLanguageForMonaco(selectedLanguage)}
                  value={code}
                  onChange={handleEditorChange}
                  onMount={handleEditorDidMount}
                  theme="vs-dark"
                  options={{
                    fontSize: 14,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                    insertSpaces: true,
                    wordWrap: 'on',
                    lineNumbers: 'on',
                    glyphMargin: false,
                    folding: true,
                    lineDecorationsWidth: 10,
                    lineNumbersMinChars: 3,
                    renderLineHighlight: 'line',
                    selectOnLineNumbers: true,
                    roundedSelection: false,
                    readOnly: false,
                    cursorStyle: 'line',
                    mouseWheelZoom: true,
                  }}
                />
              </div>

            </div>
          )}

          {activeRightTab === 'testcase' && (
            <div className="flex-1 p-4 overflow-y-auto">
              <h3 className="font-semibold mb-4">Test Results</h3>
              {runResult ? (
                <div className={`alert ${runResult.success ? 'alert-success' : 'alert-error'} mb-4`}>
                  <div>
                    {runResult.success ? (
                      <div>
                        <h4 className="font-bold">✅ All test cases passed!</h4>
                        <p className="text-sm mt-2">Runtime: {runResult.runtime+" sec"}</p>
                        <p className="text-sm">Memory: {runResult.memory+" KB"}</p>

                        <div className="mt-4 space-y-2">
                          {runResult.testCases.map((tc, i) => (
                            <div key={i} className="bg-base-100 p-3 rounded text-xs">
                              <div className="font-mono">
                                <div><strong>Input:</strong> {tc.stdin}</div>
                                <div><strong>Expected:</strong> {tc.expected_output}</div>
                                <div><strong>Output:</strong> {tc.stdout}</div>
                                <div className={'text-green-600'}>
                                  {'✓ Passed'}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <h4 className="font-bold">❌ Error</h4>
                        {runResult.error && (
                          <pre className="mt-2 text-xs whitespace-pre-wrap">{runResult.error}</pre>
                        )}
                        <div className="mt-4 space-y-2">
                          {(runResult.testCases || []).map((tc, i) => (
                            <div key={i} className="bg-base-100 p-3 rounded text-xs">
                              <div className="font-mono">
                                <div><strong>Input:</strong> {tc.stdin}</div>
                                <div><strong>Expected:</strong> {tc.expected_output}</div>
                                <div><strong>Output:</strong> {tc.stdout}</div>
                                <div className={tc.status_id==3 ? 'text-green-600' : 'text-red-600'}>
                                  {tc.status_id==3 ? '✓ Passed' : '✗ Failed'}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-base-content/50">
                  Click "Run" to test your code with the example test cases.
                </div>
              )}
            </div>
          )}

          {activeRightTab === 'result' && (
            <div className="flex-1 p-4 overflow-y-auto">
              <h3 className="font-semibold mb-4">Submission Result</h3>
              {submitResult ? (
                <div className={`alert ${submitResult.accepted ? 'alert-success' : 'alert-error'}`}>
                  <div>
                    {submitResult.accepted ? (
                      <div>
                        <h4 className="font-bold text-lg">🎉 Accepted</h4>
                        <div className="mt-4 space-y-2">
                          <p>Test Cases Passed: {submitResult.passedTestCases}/{submitResult.totalTestCases}</p>
                          <p>Runtime: {submitResult.runtime + " sec"}</p>
                          <p>Memory: {submitResult.memory + "KB"} </p>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <h4 className="font-bold text-lg">
                          ❌ {submitResult.status === 'wrong' ? 'Wrong Answer' : submitResult.status === 'error' ? 'Error' : 'Submission Failed'}
                        </h4>
                        {submitResult.error && (
                          <pre className="mt-2 text-xs whitespace-pre-wrap">{submitResult.error}</pre>
                        )}
                        <div className="mt-4 space-y-2">
                          <p>Test Cases Passed: {submitResult.passedTestCases}/{submitResult.totalTestCases}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-base-content/50">
                  Click "Submit" to submit your solution for evaluation.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
    </div>
  );
};

export default ProblemPage;