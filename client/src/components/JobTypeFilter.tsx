const JOB_TYPES = [
  { value: 'all', label: 'All' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'sales', label: 'Sales' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'design', label: 'Design' },
  { value: 'product', label: 'Product' },
  { value: 'operations', label: 'Operations' },
  { value: 'finance', label: 'Finance' },
  { value: 'data', label: 'Data' },
  { value: 'hr', label: 'HR' },
  { value: 'other', label: 'Other' },
];

interface JobTypeFilterProps {
  value: string;
  onChange: (value: string) => void;
}

export default function JobTypeFilter({ value, onChange }: JobTypeFilterProps) {
  return (
    <div className="flex flex-wrap gap-1">
      {JOB_TYPES.map((type) => (
        <button
          key={type.value}
          onClick={() => onChange(type.value)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            value === type.value
              ? 'bg-indigo-600 text-white'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          {type.label}
        </button>
      ))}
    </div>
  );
}

export { JOB_TYPES };
