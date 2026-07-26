import { createFileRoute } from "@tanstack/react-router";
import { MedicalLibraryBrowser } from "@/components/medical-library-browser";

export const Route = createFileRoute("/_authenticated/medical-library")({
  component: MedicalLibrary,
  head: () => ({
    meta: [
      { title: "Medical Library — StepFighter" },
      { name: "description", content: "Browse the StepFighter medical library: specialty chapters, illustrated topics and high-yield tables." },
      { property: "og:title", content: "Medical Library — StepFighter" },
      { property: "og:description", content: "Browse specialty chapters, illustrated topics and high-yield tables inside StepFighter." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function MedicalLibrary() {
  return <MedicalLibraryBrowser />;
}
