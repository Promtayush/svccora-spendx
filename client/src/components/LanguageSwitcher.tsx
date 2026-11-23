import { useTranslation } from "react-i18next";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/custom/Select";
import { Globe } from "lucide-react";
import { useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const languages = [
  { code: "en", name: "English" },
  { code: "hi", name: "हिन्दी" },
  { code: "de", name: "Deutsch" },
  { code: "fr", name: "Français" },
  { code: "ja", name: "日本語" },
  { code: "ar", name: "العربية" },
];

interface LanguageSwitcherProps {
  collapsed?: boolean;
}

const LanguageSwitcherPage = ({ collapsed = false }: LanguageSwitcherProps) => {
  const { i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem("lang", lng);
  };

  useEffect(()=>{
    document.body.dir = i18n.dir()
  }, [i18n , i18n.language])

  const currentLanguage =
    languages.find((language) => language.code === i18n.language)?.name || "English";

  if (collapsed) {
    return (
      <div className="flex justify-center border-b border-border p-2">
        <DropdownMenu dir={i18n.dir()}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title="Language"
              aria-label="Language"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <Globe className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="right"
            align="start"
            className="z-[60] min-w-36"
          >
            {languages.map((language) => (
              <DropdownMenuItem
                key={language.code}
                onSelect={() => changeLanguage(language.code)}
                className={language.code === i18n.language ? "bg-accent" : ""}
              >
                {language.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <div className="min-w-0 border-b border-border p-4">
      <Select
        value={currentLanguage}
        onValueChange={(languageName) => {
          const language = languages.find((item) => item.name === languageName);
          if (language) changeLanguage(language.code);
        }}
      >
        <SelectTrigger className="flex w-full min-w-0 items-center gap-2">
          <Globe className="w-4 h-4 text-muted-foreground" />
          <SelectValue placeholder={currentLanguage} />
        </SelectTrigger>
        <SelectContent>
          {languages.map((language) => (
            <SelectItem key={language.code} value={language.name}>
              <span className="flex items-center gap-2">{language.name}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default LanguageSwitcherPage;
