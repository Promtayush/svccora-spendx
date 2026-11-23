import { useState, useMemo } from "react";
import { Input } from "@/components/custom/Input";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { CalendarIcon, Undo2, FileText, X, Search, ChevronDown, Check, Layers, CreditCard, Wallet } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/custom/Select";
import { Button } from "@/components/custom/Button";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useCostCenters, useCategories, type CategoryMasterItem } from "@/hooks/useExpenses";
import { Button as UiButton } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const AddClaims = () => {
  const { t, i18n } = useTranslation("addClaims");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: costCenters = [] } = useCostCenters();
  const { data: categories = [], isLoading: isCategoriesLoading } = useCategories();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isCategoryPopoverOpen, setIsCategoryPopoverOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string>("ALL");
  const [categorySearch, setCategorySearch] = useState<string>("");

  const [fieldErrors, setFieldErrors] = useState({
    category: "",
    date: "",
    amount: "",
  });

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    claimType: "",
    categoryCode: "",
    paymentMethod: "REIMBURSEMENT",
    costCenterCode: "",
    date: "",
    files: [] as File[],
    description: "",
    contact: "",
    amount: "",
  });

  const today = new Date();
  const startYear = today.getFullYear() - 2;

  const formatDateForApi = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const parseDateInput = (value: string) => {
    const [year, month, day] = value.split("-").map(Number);
    return year && month && day ? new Date(year, month - 1, day) : undefined;
  };

  const normalizeAmount = (value: string) => {
    const stripped = value.replace(/[^\d.,]/g, "");
    const lastDot = stripped.lastIndexOf(".");
    const lastComma = stripped.lastIndexOf(",");
    let normalized = stripped;

    if (lastDot >= 0 && lastComma >= 0) {
      const decimalSeparator = lastDot > lastComma ? "." : ",";
      const thousandsSeparator = decimalSeparator === "." ? "," : ".";
      normalized = stripped.replace(new RegExp(`\\${thousandsSeparator}`, "g"), "");
      if (decimalSeparator === ",") normalized = normalized.replace(",", ".");
    } else if (lastComma >= 0) {
      const commaParts = stripped.split(",");
      const isThousandsFormat =
        commaParts.length > 1 &&
        commaParts.slice(1).every((part) => part.length === 3);
      normalized = isThousandsFormat
        ? stripped.replace(/,/g, "")
        : stripped.replace(",", ".");
    }

    const [whole = "", decimal] = normalized.split(".");
    return decimal === undefined
      ? whole
      : `${whole}.${decimal.slice(0, 2)}`;
  };

  const formatAmount = (value: string) => {
    const numericValue = Number(normalizeAmount(value));
    return Number.isFinite(numericValue)
      ? new Intl.NumberFormat("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(numericValue)
      : value;
  };

  const displayedDate = parseDateInput(formData.date);
  const dateFormatter = new Intl.DateTimeFormat(i18n.language, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const categoryGroups = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => map.set(c.groupCode, c.groupName));
    return Array.from(map.entries()).map(([code, name]) => ({ code, name }));
  }, [categories]);

  const filteredCategories = useMemo(() => {
    return categories.filter((c) => {
      const matchesGroup = selectedGroup === "ALL" || c.groupCode === selectedGroup;
      const q = categorySearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        c.subcategoryName.toLowerCase().includes(q) ||
        c.categoryName.toLowerCase().includes(q) ||
        c.groupName.toLowerCase().includes(q);
      return matchesGroup && matchesSearch;
    });
  }, [categories, selectedGroup, categorySearch]);

  const selectedCategoryItem = useMemo(() => {
    return categories.find((c) => c.code === formData.categoryCode || c.subcategoryName === formData.claimType);
  }, [categories, formData.categoryCode, formData.claimType]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setFormData({ ...formData, files: [file] });
      if (file.type.startsWith("image/")) {
        setPreviewUrl(URL.createObjectURL(file));
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const handleClearFile = () => {
    setFormData({ ...formData, files: [] });
    setPreviewUrl(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors = { category: "", date: "", amount: "" };
    const selectedDate = parseDateInput(formData.date);
    const normalizedAmount = normalizeAmount(formData.amount);
    const numericAmount = Number(normalizedAmount);
    const todayAtMidnight = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );

    if (!formData.claimType) {
      nextErrors.category = "Please select an expense category.";
    }
    if (!selectedDate) nextErrors.date = t("addClaim.validation.dateRequired");
    else if (selectedDate > todayAtMidnight) {
      nextErrors.date = t("addClaim.validation.dateFuture");
    }
    if (!normalizedAmount) {
      nextErrors.amount = t("addClaim.validation.amountRequired");
    } else if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      nextErrors.amount = t("addClaim.validation.amountPositive");
    } else if (numericAmount > 10000000) {
      nextErrors.amount = t("addClaim.validation.amountTooLarge");
    }

    setFieldErrors(nextErrors);
    if (nextErrors.date || nextErrors.amount || nextErrors.category) return;

    setIsSubmitting(true);
    try {
      let receiptUrl: string | undefined = undefined;
      if (formData.files && formData.files.length > 0) {
        const uploadData = new FormData();
        uploadData.append("receipt", formData.files[0]);
        const uploadRes = await apiFetch<{ receiptUrl: string }>("/api/expenses/upload", {
          method: "POST",
          body: uploadData,
        });
        receiptUrl = uploadRes.receiptUrl;
      }

      await apiFetch("/api/expenses", {
        method: "POST",
        body: {
          amount: parseFloat(normalizedAmount),
          description: formData.description + (formData.contact ? ` (Contact: ${formData.contact})` : ""),
          category: formData.claimType,
          categoryCode: formData.categoryCode || undefined,
          paymentMethod: formData.paymentMethod,
          date: formData.date,
          costCenterCode: formData.costCenterCode || undefined,
          receiptUrl,
        },
      });

      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success(t("addClaim.success") || "Expense report submitted successfully!");
      navigate("/claims");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (t("addClaim.failure") || "Failed to submit claim."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{t("addClaim.title")}</h1>
          <p className="text-muted-foreground">
            {t("addClaim.subtitle")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="enterprise" className="gap-2">
            <Link to="/claims">{t("addClaim.back")}</Link>
            <Link to="/claims"><Undo2 /></Link>
          </Button>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-12 flex flex-col gap-6 max-w-xl"
      >
        {/* Category Master Selector (2-tier Group + Searchable Subcategory) */}
        <div className="flex flex-col gap-2">
          <label className="font-medium flex items-center justify-between">
            <span>
              Expense Category <span className="text-destructive">*</span>
            </span>
            {selectedCategoryItem && (
              <span className="text-xs text-primary font-mono bg-primary/10 px-2 py-0.5 rounded">
                Code: {selectedCategoryItem.code}
              </span>
            )}
          </label>

          <Popover open={isCategoryPopoverOpen} onOpenChange={setIsCategoryPopoverOpen}>
            <PopoverTrigger asChild>
              <UiButton
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={isCategoryPopoverOpen}
                className={cn(
                  "w-full justify-between text-left font-normal h-auto min-h-[46px] py-2 px-3 border-input",
                  !formData.claimType && "text-muted-foreground"
                )}
              >
                {selectedCategoryItem ? (
                  <div className="flex flex-col text-left">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-primary" />
                      {selectedCategoryItem.groupName} &gt; {selectedCategoryItem.categoryName}
                    </span>
                    <span className="font-semibold text-foreground text-sm mt-0.5">
                      {selectedCategoryItem.subcategoryName}
                    </span>
                  </div>
                ) : (
                  <span className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Search className="w-4 h-4" />
                    Search category, e.g. "Uber", "Hotel", "Fuel", "Lunch", "Laptop"...
                  </span>
                )}
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </UiButton>
            </PopoverTrigger>
            <PopoverContent className="w-[520px] max-w-[95vw] p-0 z-[60]" align="start">
              <div className="p-3 border-b space-y-2.5 bg-muted/30">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Type to filter categories..."
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    className="pl-8 h-9 text-sm"
                    autoFocus
                  />
                  {categorySearch && (
                    <button
                      type="button"
                      onClick={() => setCategorySearch("")}
                      className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Group Filter Pills */}
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                  <button
                    type="button"
                    onClick={() => setSelectedGroup("ALL")}
                    className={cn(
                      "text-xs px-2.5 py-1 rounded-full whitespace-nowrap transition-colors font-medium border cursor-pointer",
                      selectedGroup === "ALL"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground hover:bg-muted border-border"
                    )}
                  >
                    All Groups ({categories.length})
                  </button>
                  {categoryGroups.map((grp) => (
                    <button
                      key={grp.code}
                      type="button"
                      onClick={() => setSelectedGroup(grp.code)}
                      className={cn(
                        "text-xs px-2.5 py-1 rounded-full whitespace-nowrap transition-colors font-medium border cursor-pointer",
                        selectedGroup === grp.code
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground hover:bg-muted border-border"
                      )}
                    >
                      {grp.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scrollable Subcategories List */}
              <div className="max-h-[300px] overflow-y-auto p-1 divide-y divide-border/40">
                {isCategoriesLoading ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Loading categories...
                  </div>
                ) : filteredCategories.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No matching categories found. Try a different search term.
                  </div>
                ) : (
                  filteredCategories.map((cat) => {
                    const isSelected =
                      formData.categoryCode === cat.code ||
                      formData.claimType === cat.subcategoryName;
                    return (
                      <button
                        key={cat.code}
                        type="button"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            claimType: cat.subcategoryName,
                            categoryCode: cat.code,
                          });
                          setIsCategoryPopoverOpen(false);
                          setCategorySearch("");
                          setFieldErrors((prev) => ({ ...prev, category: "" }));
                        }}
                        className={cn(
                          "w-full text-left p-2.5 rounded-md text-sm transition-colors flex items-start justify-between cursor-pointer group",
                          isSelected
                            ? "bg-primary/10 text-primary font-medium"
                            : "hover:bg-accent hover:text-accent-foreground"
                        )}
                      >
                        <div className="flex flex-col">
                          <span className="text-[11px] text-muted-foreground group-hover:text-accent-foreground/70 flex items-center gap-1">
                            <span className="font-semibold text-primary/80">{cat.groupName}</span>
                            <span>&gt;</span>
                            <span>{cat.categoryName}</span>
                          </span>
                          <span className="font-medium text-foreground group-hover:text-accent-foreground text-sm mt-0.5">
                            {cat.subcategoryName}
                          </span>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-primary shrink-0 mt-1" />}
                      </button>
                    );
                  })
                )}
              </div>
            </PopoverContent>
          </Popover>
          {fieldErrors.category && (
            <p className="text-sm text-destructive" role="alert">
              {fieldErrors.category}
            </p>
          )}
        </div>

        {/* Payment Method Selector */}
        <div className="flex flex-col gap-2">
          <label className="font-medium">Payment Mechanism</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, paymentMethod: "REIMBURSEMENT" })}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border text-left transition-all cursor-pointer",
                formData.paymentMethod === "REIMBURSEMENT"
                  ? "border-primary bg-primary/5 text-primary shadow-xs ring-1 ring-primary"
                  : "border-input bg-card text-muted-foreground hover:bg-muted/50"
              )}
            >
              <Wallet className="w-5 h-5 shrink-0" />
              <div>
                <div className="font-semibold text-sm text-foreground">Out-of-Pocket Reimbursement</div>
                <div className="text-xs text-muted-foreground">Paid by employee; to be refunded</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setFormData({ ...formData, paymentMethod: "CORPORATE_CARD" })}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border text-left transition-all cursor-pointer",
                formData.paymentMethod === "CORPORATE_CARD"
                  ? "border-primary bg-primary/5 text-primary shadow-xs ring-1 ring-primary"
                  : "border-input bg-card text-muted-foreground hover:bg-muted/50"
              )}
            >
              <CreditCard className="w-5 h-5 shrink-0" />
              <div>
                <div className="font-semibold text-sm text-foreground">Company Corporate Card</div>
                <div className="text-xs text-muted-foreground">Billed directly to company account</div>
              </div>
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="font-medium">Cost Object / Cost Center</label>
          <select
            value={formData.costCenterCode}
            onChange={(e) => setFormData({ ...formData, costCenterCode: e.target.value })}
            className="w-[250px] rounded-md border border-input bg-background p-2.5 text-sm"
          >
            <option value="">Default Cost Center (No Split)</option>
            {costCenters.map((cc) => (
              <option key={cc.code} value={cc.code}>
                {cc.code} — {cc.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="font-medium">{t("addClaim.date")}</label>
          <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
            <PopoverTrigger asChild>
              <UiButton
                type="button"
                variant="outline"
                className={cn(
                  "w-[250px] justify-start text-left font-normal",
                  !displayedDate && "text-muted-foreground"
                )}
                aria-label={t("addClaim.date")}
                aria-invalid={Boolean(fieldErrors.date)}
              >
                <CalendarIcon className="h-4 w-4" />
                {displayedDate
                  ? dateFormatter.format(displayedDate)
                  : t("addClaim.datePlaceholder")}
              </UiButton>
            </PopoverTrigger>
            <PopoverContent className="z-[60] w-auto bg-popover p-0" align="start">
              <Calendar
                mode="single"
                selected={displayedDate}
                onSelect={(date) => {
                  setFormData({
                    ...formData,
                    date: date ? formatDateForApi(date) : "",
                  });
                  setFieldErrors({ ...fieldErrors, date: "" });
                  setIsDatePickerOpen(false);
                }}
                disabled={{ after: today }}
                captionLayout="dropdown"
                startMonth={new Date(startYear, 0, 1)}
                endMonth={today}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          {fieldErrors.date && (
            <p className="text-sm text-destructive" role="alert">
              {fieldErrors.date}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="font-medium">{t("addClaim.upload")} (Receipt / Bill / Invoice)</label>
          <Input
            type="file"
            accept="image/*,.pdf"
            className="w-[300px]"
            onChange={handleFileChange}
          />
          {formData.files && formData.files.length > 0 && (
            <div className="mt-2 flex items-center gap-3 p-3 rounded-lg border border-border bg-card/60 max-w-md">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Receipt Preview"
                  className="h-16 w-16 object-cover rounded-md border border-border"
                />
              ) : (
                <div className="h-16 w-16 bg-muted flex items-center justify-center rounded-md border border-border">
                  <FileText className="w-8 h-8 text-primary" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate text-foreground">
                  {formData.files[0].name}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {(formData.files[0].size / 1024).toFixed(1)} KB • {formData.files[0].type || "Document"}
                </p>
                <p className="text-[11px] text-success font-medium">Ready for upload</p>
              </div>
              <button
                type="button"
                onClick={handleClearFile}
                className="p-1 rounded-full text-muted-foreground hover:text-destructive hover:bg-muted"
                title="Remove file"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="font-medium">{t("addClaim.description")}</label>
          <textarea
            name="description"
            cols={50}
            rows={4}
            className="bg-transparent outline-none text-white border border-gray-500 rounded-md p-2"
            placeholder={t("addClaim.descriptionPlaceholder")}
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="font-medium">{t("addClaim.contact")}</label>
          <Input
            type="text"
            className="text-white w-[300px]"
            placeholder={t("addClaim.contactPlaceholder")}
            value={formData.contact}
            onChange={(e) =>
              setFormData({ ...formData, contact: e.target.value })
            }
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="font-medium">{t("addClaim.amount")}</label>
          <div className="relative w-[250px]">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center border-r border-input px-3 text-muted-foreground">
              ₹
            </span>
            <Input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              className="w-full pl-10 pr-14 text-white"
              placeholder="0.00"
              value={formData.amount}
              aria-label={t("addClaim.amount")}
              aria-invalid={Boolean(fieldErrors.amount)}
              aria-describedby={fieldErrors.amount ? "amount-error" : undefined}
              onFocus={() =>
                setFormData({
                  ...formData,
                  amount: normalizeAmount(formData.amount),
                })
              }
              onBlur={() =>
                setFormData({
                  ...formData,
                  amount: formatAmount(formData.amount),
                })
              }
              onChange={(e) => {
                setFormData({
                  ...formData,
                  amount: normalizeAmount(e.target.value),
                });
                setFieldErrors({ ...fieldErrors, amount: "" });
              }}
            />
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center border-l border-input px-3 text-sm text-muted-foreground">
              {t("addClaim.currencyLabel")}
            </span>
          </div>
          {fieldErrors.amount && (
            <p id="amount-error" className="text-sm text-destructive" role="alert">
              {fieldErrors.amount}
            </p>
          )}
        </div>

        <div>
          <Button type="submit" className="mt-4" disabled={isSubmitting}>
            {t("addClaim.submit")}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AddClaims;
