import { LabParserEngine } from "@/components/engines/LabParserEngine";

export const LabFileProcessor = {
  process(fileName, rawText) {
    const parsed = LabParserEngine.parse(rawText);
    return {
      ...parsed,
      fileName: fileName || "auto",
    };
  },
};

export default LabFileProcessor;
