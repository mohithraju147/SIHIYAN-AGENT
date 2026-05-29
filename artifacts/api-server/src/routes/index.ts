import { Router, type IRouter } from "express";
import healthRouter from "./health";
import stockRouter from "./stock";
import dispatchRouter from "./dispatch";
import inventoryRouter from "./inventory";
import dashboardRouter from "./dashboard";
import reportsRouter from "./reports";
import ocrRouter from "./ocr";
import geminiRouter from "./gemini";
import voiceRouter from "./voice";
import settingsRouter from "./settings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(stockRouter);
router.use(dispatchRouter);
router.use(inventoryRouter);
router.use(dashboardRouter);
router.use(reportsRouter);
router.use(ocrRouter);
router.use(geminiRouter);
router.use(voiceRouter);
router.use(settingsRouter);

export default router;
