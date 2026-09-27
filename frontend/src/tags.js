// Shared skill tags. Must match SKILL_TAGS in backend/skills.py exactly: the API
// rejects profiles with any other value, and the LLM tags tasks from the same list.
export const SKILL_TAGS = [
  "frontend",
  "backend",
  "database",
  "auth",
  "ui-design",
  "devops",
  "data-ml",
  "react",
  "css",
  "firebase",
  "apis",
  "python",
  "javascript",
  "node",
  "testing",
  "product-management",
  "mobile",
];

// Display names for the tag values above. Only used for showing tags, never sent to the API.
const TAG_LABELS = {
  "ui-design": "UI design",
  devops: "DevOps",
  "data-ml": "data/ML",
  react: "React",
  css: "CSS",
  firebase: "Firebase",
  apis: "APIs",
  python: "Python",
  javascript: "JavaScript",
  node: "Node",
  "product-management": "product management",
};

export const tagLabel = (tag) => TAG_LABELS[tag] ?? tag;
