// Vercel "Ignored Build Step": exit 1 to build, exit 0 to skip.
// Every deployment stores its function bundles against the Hobby plan's
// Functions Storage, and each pushed branch used to add a preview. Only the
// production branch, and branches named preview/..., are built now.
const branch = process.env.VERCEL_GIT_COMMIT_REF ?? "";
const build = branch === "main" || branch.startsWith("preview/") || process.env.VERCEL_ENV === "production";
console.log(build ? `Building ${branch || "production"}.` : `Skipping the preview build for ${branch}.`);
process.exit(build ? 1 : 0);
