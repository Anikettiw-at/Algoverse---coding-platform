const {getLanguageById,runTestCases} = require("../utils/problemUtility");
const Problem = require("../models/problem");
const User = require("../models/user");
const Submission = require("../models/submission");
const SolutionVideo = require("../models/solutionVideo")

// Har reference solution ko visible test cases pe Judge0 se verify karta hai.
// Galti mile to error message return karta hai, sab sahi ho to null.
const validateReferenceSolutions = async (referenceSolution, visibleTestCases)=>{

  if(!Array.isArray(referenceSolution) || referenceSolution.length===0)
    return "Reference solution is required";

  if(!Array.isArray(visibleTestCases) || visibleTestCases.length===0)
    return "Visible test cases are required";

  for(const {language,completeCode} of referenceSolution){

    const languageId = getLanguageById(language);
    if(!languageId)
      return `Unsupported language: ${language}`;

    const testResult = await runTestCases(completeCode, languageId, visibleTestCases);

    for(const test of testResult){
      if(test.status_id!=3){
        return `Reference solution (${language}) failed: ${test.status?.description || 'Wrong Answer'}`;
      }
    }
  }

  return null;
}

const createProblem = async (req,res)=>{

  // API request to authenticate user:
    const {title,description,difficulty,tags,
        visibleTestCases,hiddenTestCases,startCode,
        referenceSolution, problemCreator
    } = req.body;


    try{

      const validationError = await validateReferenceSolutions(referenceSolution, visibleTestCases);
      if(validationError)
        return res.status(400).send(validationError);

      // We can store it in our DB

    const userProblem =  await Problem.create({
        ...req.body,
        problemCreator: req.result._id
      });

      res.status(201).send("Problem Saved Successfully");
    }
    catch(err){
        res.status(400).send("Error: "+err);
    }
}

const updateProblem = async (req,res)=>{

  const {id} = req.params;
  const {title,description,difficulty,tags,
    visibleTestCases,hiddenTestCases,startCode,
    referenceSolution, problemCreator
   } = req.body;

  try{

     if(!id){
      return res.status(400).send("Missing ID Field");
     }

    const DsaProblem =  await Problem.findById(id);
    if(!DsaProblem)
    {
      return res.status(404).send("ID is not persent in server");
    }

    const validationError = await validateReferenceSolutions(referenceSolution, visibleTestCases);
    if(validationError)
      return res.status(400).send(validationError);

  // problemCreator body se change nahi hona chahiye
  const {problemCreator: _ignored, ...updates} = req.body;
  const newProblem = await Problem.findByIdAndUpdate(id , updates, {runValidators:true, new:true});

  res.status(200).send(newProblem);
  }
  catch(err){
      res.status(500).send("Error: "+err);
  }
}

const deleteProblem = async(req,res)=>{

  const {id} = req.params;
  try{

    if(!id)
      return res.status(400).send("ID is Missing");

   const deletedProblem = await Problem.findByIdAndDelete(id);

   if(!deletedProblem)
    return res.status(404).send("Problem is Missing");

   // Is problem se jude records bhi saaf karo (orphan data na rahe)
   await Promise.all([
     Submission.deleteMany({problemId:id}),
     User.updateMany({problemSolved:id},{$pull:{problemSolved:id}})
   ]);

   res.status(200).send("Successfully Deleted");
  }
  catch(err){

    res.status(500).send("Error: "+err);
  }
}


const getProblemById = async(req,res)=>{

  const {id} = req.params;
  try{

    if(!id)
      return res.status(400).send("ID is Missing");

    const getProblem = await Problem.findById(id).select('_id title description difficulty tags visibleTestCases startCode referenceSolution ');

    // video ka jo bhi url wagera le aao

   if(!getProblem)
    return res.status(404).send("Problem is Missing");

   const videos = await SolutionVideo.findOne({problemId:id});

   if(videos){

   const responseData = {
    ...getProblem.toObject(),
    secureUrl:videos.secureUrl,
    thumbnailUrl : videos.thumbnailUrl,
    duration : videos.duration,
   }

   return res.status(200).send(responseData);
   }

   res.status(200).send(getProblem);

  }
  catch(err){
    res.status(500).send("Error: "+err);
  }
}

// Admin edit form ke liye poora problem (hidden test cases ke saath)
const getProblemForAdmin = async(req,res)=>{

  try{
    const problem = await Problem.findById(req.params.id);

    if(!problem)
      return res.status(404).send("Problem is Missing");

    res.status(200).send(problem);
  }
  catch(err){
    res.status(500).send("Error: "+err);
  }
}

const getAllProblem = async(req,res)=>{

  try{

    const getProblem = await Problem.find({}).select('_id title difficulty tags');

   res.status(200).send(getProblem);
  }
  catch(err){
    res.status(500).send("Error: "+err);
  }
}


const solvedAllProblembyUser =  async(req,res)=>{

    try{

      const userId = req.result._id;

      const user =  await User.findById(userId).populate({
        path:"problemSolved",
        select:"_id title difficulty tags"
      });

      if(!user)
        return res.status(404).send("User not found");

      res.status(200).send(user.problemSolved);

    }
    catch(err){
      res.status(500).send("Server Error");
    }
}

const submittedProblem = async(req,res)=>{

  try{

    const userId = req.result._id;
    const problemId = req.params.pid;

   const ans = await Submission.find({userId,problemId}).sort({createdAt:-1});

  // Khaali ho to bhi array hi bhejo (frontend .map/.length use karta hai)
  res.status(200).send(ans);

  }
  catch(err){
     res.status(500).send("Internal Server Error");
  }
}



module.exports = {createProblem,updateProblem,deleteProblem,getProblemById,getProblemForAdmin,getAllProblem,solvedAllProblembyUser,submittedProblem};


