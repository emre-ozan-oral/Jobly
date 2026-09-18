/* exported JoblyInsights */
// Lightweight, fully local job-posting insights: tech stack + experience
// requirement + seniority level, all extracted from the page text with
// keyword matching and regex - no network call, no LLM, no added latency.
// Deliberately heuristic (a fixed keyword list beats parsing/understanding
// the posting), so it can run synchronously inside the content script the
// instant the popup asks for it.

const JoblyInsights = (() => {
  // Each entry: a display label plus the literal strings to look for.
  // Matching is case-insensitive with custom boundaries (see buildTermRegex)
  // so "C++", "C#", ".NET" etc. match correctly and "Go" doesn't match
  // inside "Google".
  const TECH_STACK = [
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

  // Ordered most-specific-first so a range isn't swallowed by a looser
  // "at least" or generic pattern that appears later in the list.
  const EXPERIENCE_PATTERNS = [
    // "3-5 years", "3 to 5 years of experience"
    {
      regex: /(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\+?\s*years?/i,
      format: (m) => `${m[1]}-${m[2]} years`,
    },
    // "5+ years"
    { regex: /(\d{1,2})\+\s*years?/i, format: (m) => `${m[1]}+ years` },
    // "at least 3 years" / "minimum 3 years" / "minimum of 3 years"
    {
      regex: /(?:at least|minimum(?: of)?|min\.?)\s*(\d{1,2})\s*years?/i,
      format: (m) => `${m[1]}+ years (minimum)`,
    },
    // "3 years of professional/relevant/hands-on experience"
    {
      regex: /(\d{1,2})\s*years?\s*(?:of\s*)?(?:professional\s*|relevant\s*|hands-on\s*)?experience/i,
      format: (m) => `${m[1]}+ years`,
    },
    // Turkish range: "3-5 yıl"
    {
      regex: /(\d{1,2})\s*(?:-|–)\s*(\d{1,2})\s*y[ıi]l/i,
      format: (m) => `${m[1]}-${m[2]} yıl`,
    },
    // Turkish: "en az 3 yıl"
    {
      regex: /en az\s*(\d{1,2})\s*y[ıi]l/i,
      format: (m) => `${m[1]}+ yıl (en az)`,
    },
    // Turkish: "3 yıl tecrübe/deneyim"
    {
      regex: /(\d{1,2})\+?\s*y[ıi]l\s*(?:tecr[üu]be|deneyim)/i,
      format: (m) => `${m[1]}+ yıl`,
    },
  ];

  const SENIORITY_KEYWORDS = [
    { label: "Intern", terms: ["internship", "intern ", "stajyer", "staj programı"] },
    { label: "Junior", terms: ["junior", "entry level", "entry-level", "yeni mezun"] },
    { label: "Mid-level", terms: ["mid-level", "mid level", "intermediate"] },
    { label: "Senior", terms: ["senior", "kıdemli"] },
    { label: "Staff/Principal", terms: ["staff engineer", "principal engineer"] },
    { label: "Lead", terms: ["tech lead", "team lead", "lead engineer"] },
  ];

  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // Custom "boundary": not preceded/followed by a word char or by +, #, .
  // (so "C++" and ".NET" match cleanly, and "Go" doesn't match inside
  // "Google" or "Golang" text like "goes"). Lookbehind is supported in all
  // Chromium versions the extension targets.
  function buildTermRegex(term) {
    const esc = escapeRegExp(term.toLowerCase());
    // Excludes word chars / + / # on both sides (so "C++", "C#" don't merge
    // into surrounding words) but deliberately NOT "." on the right, so a
    // term at the end of a sentence ("...experience with C#.") still
    // matches. The left side keeps excluding "." too, so ".NET" doesn't
    // false-match the tail of "asp.net" (that's handled by its own term).
    return new RegExp(`(?<![\w+#.])${esc}(?![\w+#])`, "i");
  }

  function detectTechStack(text, limit = 24) {
    const found = [];
    for (const { display, terms } of TECH_STACK) {
      if (terms.some((term) => buildTermRegex(term).test(text))) {
        found.push(display);
      }
      if (found.length >= limit) break;
    }
    return found;
  }

  function detectExperience(text) {
    for (const { regex, format } of EXPERIENCE_PATTERNS) {
      const m = text.match(regex);
      if (m) return format(m);
    }
    return null;
  }

  function detectSeniority(text) {
    const lower = text.toLowerCase();
    for (const { label, terms } of SENIORITY_KEYWORDS) {
      if (terms.some((t) => lower.includes(t))) return label;
    }
    return null;
  }

  // Bounded input length keeps this instant even on very long pages - a job
  // posting's requirements are always well within the first ~20k characters.
  function analyze(fullText) {
    const text = (fullText || "").slice(0, 20000);
    return {
      techStack: detectTechStack(text),
      experience: detectExperience(text),
      seniority: detectSeniority(text),
    };
  }

  return { analyze, detectTechStack, detectExperience, detectSeniority };
})();
