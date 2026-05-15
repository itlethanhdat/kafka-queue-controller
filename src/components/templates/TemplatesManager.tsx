"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import type { Template, TemplateType } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, MoreVertical, Pencil, Trash2, Wand2, CheckCircle, XCircle } from "lucide-react";
import { generateFromSchema, validateAgainstSchema } from "@/lib/templates/json-schema";
import { generateFromMustache, validateAgainstMustache } from "@/lib/templates/mustache";
import dynamic from "next/dynamic";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

const DEFAULT_JSON_SCHEMA = JSON.stringify(
  {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      name: { type: "string", faker: "person.fullName" },
      email: { type: "string", format: "email" },
    },
    required: ["id", "name", "email"],
  },
  null,
  2
);

const DEFAULT_MUSTACHE = `{
  "userId": "{{userId}}",
  "name": "{{name}}",
  "email": "{{email}}"
}`;

const DEFAULT_VARIABLES = JSON.stringify(
  {
    userId: "string.uuid",
    name: "person.fullName",
    email: "internet.email",
  },
  null,
  2
);

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

interface FormState {
  name: string;
  type: TemplateType;
  content: string;
  variables: string;
}

const DEFAULTS: FormState = {
  name: "",
  type: "json-schema",
  content: DEFAULT_JSON_SCHEMA,
  variables: DEFAULT_VARIABLES,
};

export default function TemplatesManager({ open, onOpenChange }: Props) {
  const templates = useLiveQuery(() => db.templates.orderBy("name").toArray(), []);
  const [formOpen, setFormOpen] = useState(false);
  const [editTpl, setEditTpl] = useState<Template | undefined>();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULTS);
  const [preview, setPreview] = useState("");
  const [validateInput, setValidateInput] = useState("");
  const [validateResult, setValidateResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const openForm = (tpl?: Template) => {
    setEditTpl(tpl);
    if (tpl) {
      setForm({
        name: tpl.name,
        type: tpl.type,
        content: tpl.content,
        variables: tpl.variables ?? DEFAULT_VARIABLES,
      });
    } else {
      setForm(DEFAULTS);
    }
    setPreview("");
    setValidateResult(null);
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error("Name required");
    const now = Date.now();
    if (editTpl?.id) {
      await db.templates.update(editTpl.id, { ...form, updatedAt: now });
      toast.success("Template updated");
    } else {
      await db.templates.add({ ...form, createdAt: now, updatedAt: now });
      toast.success("Template created");
    }
    setFormOpen(false);
  };

  const handleDelete = async () => {
    if (deleteId == null) return;
    await db.templates.delete(deleteId);
    setDeleteId(null);
    toast.success("Template deleted");
  };

  const handleGenerate = async () => {
    try {
      if (form.type === "json-schema") {
        const generated = await generateFromSchema(form.content);
        setPreview(JSON.stringify(generated, null, 2));
      } else {
        const vars = JSON.parse(form.variables || "{}");
        setPreview(generateFromMustache(form.content, vars));
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    }
  };

  const handleValidate = () => {
    try {
      if (form.type === "json-schema") {
        const r = validateAgainstSchema(form.content, validateInput);
        setValidateResult({ ok: r.valid, msg: r.valid ? "Valid!" : (r.errors ?? []).join("; ") });
      } else {
        const r = validateAgainstMustache(form.content, validateInput);
        setValidateResult({ ok: r.valid, msg: r.message });
      }
    } catch (e: unknown) {
      setValidateResult({ ok: false, msg: e instanceof Error ? e.message : "Error" });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Templates</DialogTitle>
          </DialogHeader>

          <div className="flex justify-end">
            <Button size="sm" onClick={() => openForm()}>
              <Plus className="w-4 h-4 mr-2" />
              New template
            </Button>
          </div>

          <Separator />

          {(templates ?? []).length === 0 && (
            <p className="py-4 text-sm text-center text-muted-foreground">No templates yet.</p>
          )}

          <div className="space-y-2">
            {(templates ?? []).map((tpl) => (
              <div
                key={tpl.id}
                className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/30 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium">{tpl.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(tpl.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {tpl.type}
                  </Badge>
                  <DropdownMenu>
                  <DropdownMenuTrigger className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-accent transition-colors">
                    <MoreVertical className="w-3.5 h-3.5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openForm(tpl)}>
                        <Pencil className="w-3.5 h-3.5 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeleteId(tpl.id!)}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Template edit form */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-3xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTpl ? "Edit Template" : "New Template"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="flex gap-4">
              <div className="grid gap-1.5 flex-1">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="grid gap-1.5 w-44">
                <Label>Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      type: v as TemplateType,
                      content: v === "json-schema" ? DEFAULT_JSON_SCHEMA : DEFAULT_MUSTACHE,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="json-schema">JSON Schema</SelectItem>
                    <SelectItem value="mustache">Mustache</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>{form.type === "json-schema" ? "JSON Schema" : "Mustache Template"}</Label>
              <div className="h-48 border rounded-md overflow-hidden">
                <MonacoEditor
                  height="100%"
                  language="json"
                  value={form.content}
                  onChange={(v) => setForm((f) => ({ ...f, content: v ?? "" }))}
                  options={{ minimap: { enabled: false }, fontSize: 12, wordWrap: "on", scrollBeyondLastLine: false }}
                  theme="vs-dark"
                />
              </div>
            </div>

            {form.type === "mustache" && (
              <div className="grid gap-1.5">
                <Label>Variable → Faker mappings (JSON)</Label>
                <div className="h-32 border rounded-md overflow-hidden">
                  <MonacoEditor
                    height="100%"
                    language="json"
                    value={form.variables}
                    onChange={(v) => setForm((f) => ({ ...f, variables: v ?? "{}" }))}
                    options={{ minimap: { enabled: false }, fontSize: 12, wordWrap: "on", scrollBeyondLastLine: false }}
                    theme="vs-dark"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  e.g. {"{ \"name\": \"person.fullName\", \"email\": \"internet.email\" }"}
                </p>
              </div>
            )}

            <Separator />

            {/* Generate preview */}
            <div className="grid gap-1.5">
              <div className="flex items-center gap-2">
                <Label>Preview</Label>
                <Button size="sm" variant="outline" onClick={handleGenerate}>
                  <Wand2 className="w-3.5 h-3.5 mr-2" />
                  Generate
                </Button>
              </div>
              {preview && (
                <pre className="bg-muted rounded p-3 text-xs overflow-auto max-h-32">{preview}</pre>
              )}
            </div>

            {/* Validate */}
            <div className="grid gap-1.5">
              <Label>Test validation</Label>
              <Textarea
                rows={3}
                placeholder="Paste a message value here to validate against this template…"
                value={validateInput}
                onChange={(e) => setValidateInput(e.target.value)}
              />
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={handleValidate} disabled={!validateInput}>
                  <CheckCircle className="w-3.5 h-3.5 mr-2" />
                  Validate
                </Button>
                {validateResult && (
                  <span
                    className={`flex items-center gap-1 text-xs ${
                      validateResult.ok ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {validateResult.ok ? (
                      <CheckCircle className="w-3.5 h-3.5" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5" />
                    )}
                    {validateResult.msg}
                  </span>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleSave}>{editTpl ? "Save Changes" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Any tabs using this template will still work, but
              generate/validate will stop functioning for them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
