import { Injectable } from "@nestjs/common";
import { PartTagPdfRenderer } from "@ansei/label-renderer";

@Injectable()
export class PartTagPdfService extends PartTagPdfRenderer {}
