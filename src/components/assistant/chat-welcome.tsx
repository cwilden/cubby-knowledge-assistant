"use client";

import { useState } from "react";
import {
  CircleDollarSign,
  FileText,
  Landmark,
  RotateCcw,
  Ruler,
  ShoppingCart,
  X,
  type LucideIcon,
} from "lucide-react";

const MEDICAID_STATES = [
  "Alabama",
  "Arizona",
  "California",
  "Colorado",
  "Connecticut",
  "Florida",
  "Georgia",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kentucky",
  "Louisiana",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Missouri",
  "New Hampshire",
  "New York",
  "North Carolina",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "South Carolina",
  "Tennessee",
  "Texas",
  "Virginia",
  "Washington",
  "Wisconsin",
  "All other states",
];

const TOPICS = [
  {
    description: "HCPCS guidance",
    icon: CircleDollarSign,
    label: "Billing codes",
    question: "What billing code should I use for the Cubby Bed?",
  },
  {
    description: "Insurance packets",
    icon: FileText,
    label: "Funding docs",
    question: "What documents are needed for insurance funding?",
  },
  {
    description: "Choose a state",
    icon: Landmark,
    label: "State Medicaid",
    requiresState: true,
  },
  {
    description: "Denials and next steps",
    icon: RotateCcw,
    label: "Appeals",
    question: "How should we handle appeals and denials?",
  },
  {
    description: "Forms and requests",
    icon: ShoppingCart,
    label: "Ordering",
    question: "Where can I find the order request form?",
  },
  {
    description: "Specs and dimensions",
    icon: Ruler,
    label: "Product specs",
    question: "Where can I find Cubby Bed product specifications?",
  },
];

export function ChatWelcome({
  disabled,
  onSelect,
}: {
  disabled: boolean;
  onSelect: (question: string) => void;
}) {
  const [isStatePickerOpen, setIsStatePickerOpen] = useState(false);
  const [selectedState, setSelectedState] = useState("");

  function buildStateQuestion(state: string) {
    if (state === "All other states") {
      return "What are the Medicaid requirements for Cubby Bed coverage in all other states?";
    }

    return `What are the ${state} Medicaid requirements for Cubby Bed coverage?`;
  }

  return (
    <div className="flex min-h-full items-center justify-center py-6 sm:py-8">
      <div className="w-full max-w-3xl">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#4b9dcc]">
            Supplier knowledge
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-normal text-[#444963] sm:text-3xl">
            Find supplier answers instantly
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#6c7285]">
            Search billing, ordering, funding, Medicaid requirements, product
            information, and supplier resources with source-backed answers.
          </p>
        </div>

        <div className="mt-7 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {TOPICS.map((topic) => (
            <TopicButton
              key={topic.label}
              disabled={disabled}
              description={topic.description}
              icon={topic.icon}
              label={topic.label}
              onSelect={() => {
                if ("requiresState" in topic) {
                  setIsStatePickerOpen(true);
                  return;
                }

                onSelect(topic.question);
              }}
            />
          ))}
        </div>

        {isStatePickerOpen ? (
          <div className="mt-3 rounded-md border border-[#d6e4ef] bg-[#f8fbfd] p-3">
            <div className="flex items-center justify-between gap-3">
              <label
                className="text-sm font-semibold text-[#444963]"
                htmlFor="medicaid-state"
              >
                Choose a Medicaid state
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsStatePickerOpen(false);
                  setSelectedState("");
                }}
                className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-[#7e879b] transition hover:bg-white hover:text-[#4b9dcc] focus:outline-none focus:ring-4 focus:ring-[#61b3e4]/20"
                title="Close state picker"
              >
                <X className="h-4 w-4" aria-hidden />
                <span className="sr-only">Close state picker</span>
              </button>
            </div>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <select
                id="medicaid-state"
                disabled={disabled}
                value={selectedState}
                onChange={(event) => setSelectedState(event.target.value)}
                className="h-10 min-w-0 flex-1 cursor-pointer rounded-md border border-[#c9d9e6] bg-white px-3 text-sm text-[#444963] outline-none transition focus:border-[#4b9dcc] focus:ring-4 focus:ring-[#61b3e4]/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">Select a state...</option>
                {MEDICAID_STATES.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={disabled || !selectedState}
                onClick={() => onSelect(buildStateQuestion(selectedState))}
                className="h-10 cursor-pointer rounded-md bg-[#4b9dcc] px-4 text-sm font-semibold text-white transition hover:bg-[#2f6f9d] disabled:cursor-not-allowed disabled:bg-[#a7c9dd]"
              >
                Ask
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TopicButton({
  description,
  disabled,
  icon: Icon,
  label,
  onSelect,
}: {
  description: string;
  disabled: boolean;
  icon: LucideIcon;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className="flex min-h-[4.25rem] cursor-pointer items-start gap-3 rounded-md border border-[#d6e4ef] bg-white p-3 text-left shadow-sm transition hover:border-[#61b3e4] hover:bg-[#eef7fc] focus:outline-none focus:ring-4 focus:ring-[#61b3e4]/20 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-[#4b9dcc] shadow-sm ring-1 ring-[#e1e9f1]">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-[#444963]">
          {label}
        </span>
        <span className="mt-0.5 block truncate text-xs text-[#6c7285]">
          {description}
        </span>
      </span>
    </button>
  );
}
