// Script to add TraceabilityBadge to remaining departmental pages
// This will be applied to: Technical.jsx, Legal.jsx, Finance.jsx, SCM.jsx

const pages = ['Technical', 'Legal', 'Finance', 'SCM'];

pages.forEach(page => {
  console.log(`Adding TraceabilityBadge to ${page}.jsx`);
  console.log(`1. Import: import TraceabilityBadge from "../components/TraceabilityBadge";`);
  console.log(`2. Add state: const [traceability, setTraceability] = useState(null);`);
  console.log(`3. Extract in useEffect: const traceabilityData = parsed?.data?.metadata?.traceability;`);
  console.log(`4. Set traceability: if (traceabilityData) { setTraceability(traceabilityData); }`);
  console.log(`5. Add component: <TraceabilityBadge traceability={traceability} />`);
  console.log('---');
});
