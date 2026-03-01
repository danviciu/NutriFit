import { LabFileProcessor } from "@/components/engines/LabFileProcessor";

export const LabEngine = {
  build(profile) {
    return LabFileProcessor.process(profile.labsFileName, profile.labsText);
  },
};

export default LabEngine;
