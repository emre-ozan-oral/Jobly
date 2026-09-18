// Shared, no-LLM tech-stack keyword matcher used server-side to extract
// skills from a parsed CV (see app/api/cv/route.ts). This is a straight
// TypeScript port of the same list in extension/insights.js, which does
// the identical job client-side against a job posting's page text -
// keep the two lists in sync when adding technologies.

export interface TechStackEntry {
  display: string;
  terms: string[];
}

export const TECH_STACK: TechStackEntry[] = [
    // Languages
    { display: "JavaScript", terms: ["javascript"] },
    { display: "TypeScript", terms: ["typescript"] },
    { display: "Python", terms: ["python"] },
    { display: "Java", terms: ["java"] },
    { display: "C++", terms: ["c++"] },
    { display: "C#", terms: ["c#"] },
    { display: "Go", terms: ["golang", "go lang"] },
    { display: "Ruby", terms: ["ruby"] },
    { display: "PHP", terms: ["php"] },
    { display: "Swift", terms: ["swift"] },
    { display: "Kotlin", terms: ["kotlin"] },
    { display: "Rust", terms: ["rust"] },
    { display: "Scala", terms: ["scala"] },
    { display: "R", terms: ["r language", "r programming"] },
    { display: "MATLAB", terms: ["matlab"] },
    { display: "Dart", terms: ["dart"] },
    { display: "Objective-C", terms: ["objective-c", "objective c"] },
    { display: "Bash/Shell", terms: ["bash", "shell scripting"] },
    { display: "SQL", terms: ["sql"] },
    { display: "HTML", terms: ["html"] },
    { display: "CSS", terms: ["css"] },
    { display: "Elixir", terms: ["elixir"] },
    { display: "Haskell", terms: ["haskell"] },

    // Frontend
    { display: "React", terms: ["react.js", "reactjs", "react"] },
    { display: "Angular", terms: ["angular"] },
    { display: "Vue.js", terms: ["vue.js", "vuejs", "vue"] },
    { display: "Svelte", terms: ["svelte"] },
    { display: "Next.js", terms: ["next.js", "nextjs"] },
    { display: "Nuxt.js", terms: ["nuxt.js", "nuxtjs", "nuxt"] },
    { display: "Redux", terms: ["redux"] },
    { display: "jQuery", terms: ["jquery"] },
    { display: "Tailwind CSS", terms: ["tailwind"] },
    { display: "Webpack", terms: ["webpack"] },
    { display: "Vite", terms: ["vite"] },
    { display: "GraphQL", terms: ["graphql"] },
    { display: "REST APIs", terms: ["restful api", "rest api", "restful"] },

    // Backend
    { display: "Node.js", terms: ["node.js", "nodejs", "node js"] },
    { display: "Express", terms: ["express.js", "expressjs", "express"] },
    { display: "Django", terms: ["django"] },
    { display: "Flask", terms: ["flask"] },
    { display: "FastAPI", terms: ["fastapi"] },
    { display: "Spring/Spring Boot", terms: ["spring boot", "spring framework", "springboot"] },
    { display: ".NET", terms: [".net", "asp.net", "dotnet"] },
    { display: "Ruby on Rails", terms: ["ruby on rails", "rails"] },
    { display: "Laravel", terms: ["laravel"] },
    { display: "NestJS", terms: ["nestjs", "nest.js"] },
    { display: "gRPC", terms: ["grpc"] },

    // Mobile
    { display: "React Native", terms: ["react native"] },
    { display: "Flutter", terms: ["flutter"] },
    { display: "SwiftUI", terms: ["swiftui"] },
    { display: "Jetpack Compose", terms: ["jetpack compose"] },
    { display: "Android SDK", terms: ["android sdk", "android development"] },

    // Databases
    { display: "PostgreSQL", terms: ["postgresql", "postgres"] },
    { display: "MySQL", terms: ["mysql"] },
    { display: "MongoDB", terms: ["mongodb"] },
    { display: "Redis", terms: ["redis"] },
    { display: "SQLite", terms: ["sqlite"] },
    { display: "Oracle DB", terms: ["oracle database", "oracle db"] },
    { display: "SQL Server", terms: ["sql server", "mssql"] },
    { display: "Cassandra", terms: ["cassandra"] },
    { display: "DynamoDB", terms: ["dynamodb"] },
    { display: "Elasticsearch", terms: ["elasticsearch"] },
    { display: "Firebase", terms: ["firebase"] },
    { display: "Supabase", terms: ["supabase"] },
    { display: "Snowflake", terms: ["snowflake"] },
    { display: "BigQuery", terms: ["bigquery"] },

    // Cloud / DevOps
    { display: "AWS", terms: ["aws", "amazon web services"] },
    { display: "Azure", terms: ["azure"] },
    { display: "GCP", terms: ["gcp", "google cloud"] },
    { display: "Docker", terms: ["docker"] },
    { display: "Kubernetes", terms: ["kubernetes", "k8s"] },
    { display: "Terraform", terms: ["terraform"] },
    { display: "Jenkins", terms: ["jenkins"] },
    { display: "CI/CD", terms: ["ci/cd", "continuous integration"] },
    { display: "GitHub Actions", terms: ["github actions"] },
    { display: "GitLab CI", terms: ["gitlab ci"] },
    { display: "Ansible", terms: ["ansible"] },
    { display: "Nginx", terms: ["nginx"] },
    { display: "Linux", terms: ["linux"] },

    // Data / ML / AI
    { display: "Machine Learning", terms: ["machine learning"] },
    { display: "Deep Learning", terms: ["deep learning"] },
    { display: "TensorFlow", terms: ["tensorflow"] },
    { display: "PyTorch", terms: ["pytorch"] },
    { display: "scikit-learn", terms: ["scikit-learn", "sklearn"] },
    { display: "Pandas", terms: ["pandas"] },
    { display: "NumPy", terms: ["numpy"] },
    { display: "LangChain", terms: ["langchain"] },
    { display: "LangGraph", terms: ["langgraph"] },
    { display: "LLM/GenAI", terms: ["llm", "large language model", "generative ai"] },
    { display: "NLP", terms: ["nlp", "natural language processing"] },
    { display: "Computer Vision", terms: ["computer vision"] },
    { display: "OpenAI API", terms: ["openai"] },
    { display: "Hugging Face", terms: ["hugging face", "huggingface"] },
    { display: "Apache Spark", terms: ["apache spark", "spark"] },
    { display: "Hadoop", terms: ["hadoop"] },
    { display: "Airflow", terms: ["airflow"] },
    { display: "Kafka", terms: ["kafka"] },
    { display: "RAG", terms: ["retrieval augmented generation", "rag pipeline"] },

    // Testing
    { display: "Jest", terms: ["jest"] },
    { display: "Pytest", terms: ["pytest"] },
    { display: "Selenium", terms: ["selenium"] },
    { display: "Cypress", terms: ["cypress"] },
    { display: "JUnit", terms: ["junit"] },

    // Tools
    { display: "Git", terms: ["git"] },
    { display: "Jira", terms: ["jira"] },
    { display: "Figma", terms: ["figma"] },
  ];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Same boundary rule as the extension's version: excludes word chars / + / #
// on both sides, and additionally "." on the left only, so terms like
// "C++", "C#", ".NET" match cleanly (including at the end of a sentence)
// without merging into surrounding words.
function buildTermRegex(term: string): RegExp {
  const esc = escapeRegExp(term.toLowerCase());
  return new RegExp(`(?<![\\w+#.])${esc}(?![\\w+#])`, "i");
}

/**
 * Scans free text (e.g. a parsed CV) for known technology/skill mentions
 * and returns the matched canonical display names, in list order.
 */
export function extractTechStack(text: string, limit = 60): string[] {
  const found: string[] = [];
  const bounded = (text || "").slice(0, 50000);
  for (const { display, terms } of TECH_STACK) {
    if (terms.some((term) => buildTermRegex(term).test(bounded))) {
      found.push(display);
    }
    if (found.length >= limit) break;
  }
  return found;
}
