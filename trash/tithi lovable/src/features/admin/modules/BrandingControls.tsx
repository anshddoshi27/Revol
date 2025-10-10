
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Palette, Upload, Monitor, Smartphone, Globe } from "lucide-react";

export const BrandingControls = () => {
  const [primaryColor, setPrimaryColor] = useState("#8B5CF6");
  const [secondaryColor, setSecondaryColor] = useState("#06B6D4");
  const [accentColor, setAccentColor] = useState("#F59E0B");
  
  const colorPresets = [
    { name: "Spa Purple", primary: "#8B5CF6", secondary: "#06B6D4", accent: "#F59E0B" },
    { name: "Ocean Blue", primary: "#3B82F6", secondary: "#10B981", accent: "#F59E0B" },
    { name: "Forest Green", primary: "#10B981", secondary: "#3B82F6", accent: "#EF4444" },
    { name: "Sunset Orange", primary: "#F97316", secondary: "#8B5CF6", accent: "#06B6D4" },
    { name: "Rose Gold", primary: "#F472B6", secondary: "#A78BFA", accent: "#FCD34D" },
    { name: "Modern Dark", primary: "#1F2937", secondary: "#6B7280", accent: "#F59E0B" }
  ];

  const fontOptions = [
    "Inter",
    "Roboto",
    "Open Sans",
    "Montserrat",
    "Poppins",
    "Lato",
    "Source Sans Pro",
    "Nunito"
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Branding Controls</h2>
          <p className="text-muted-foreground">Customize your spa's visual identity and domain settings</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">Preview Changes</Button>
          <Button>Save & Apply</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Color Scheme
              </CardTitle>
              <CardDescription>Choose your brand colors</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="primary-color">Primary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="primary-color"
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      placeholder="#8B5CF6"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secondary-color">Secondary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="secondary-color"
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      placeholder="#06B6D4"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accent-color">Accent Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="accent-color"
                      type="color"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      placeholder="#F59E0B"
                    />
                  </div>
                </div>
              </div>
              
              <div>
                <Label className="mb-3 block">Color Presets</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {colorPresets.map((preset, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      onClick={() => {
                        setPrimaryColor(preset.primary);
                        setSecondaryColor(preset.secondary);
                        setAccentColor(preset.accent);
                      }}
                      className="justify-start h-auto p-3"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <div className="w-4 h-4 rounded" style={{ backgroundColor: preset.primary }}></div>
                          <div className="w-4 h-4 rounded" style={{ backgroundColor: preset.secondary }}></div>
                          <div className="w-4 h-4 rounded" style={{ backgroundColor: preset.accent }}></div>
                        </div>
                        <span className="text-sm">{preset.name}</span>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Logo & Images</CardTitle>
              <CardDescription>Upload your business logo and branding images</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Business Logo</Label>
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Upload logo (PNG, JPG, SVG)</p>
                    <p className="text-xs text-muted-foreground">Max size: 2MB</p>
                    <Button variant="outline" size="sm" className="mt-2">Choose File</Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Favicon</Label>
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Upload favicon (ICO, PNG)</p>
                    <p className="text-xs text-muted-foreground">32x32 pixels</p>
                    <Button variant="outline" size="sm" className="mt-2">Choose File</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Typography</CardTitle>
              <CardDescription>Select fonts for your booking site</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="heading-font">Heading Font</Label>
                  <select className="w-full p-2 border rounded-md" id="heading-font">
                    {fontOptions.map((font) => (
                      <option key={font} value={font}>{font}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="body-font">Body Font</Label>
                  <select className="w-full p-2 border rounded-md" id="body-font">
                    {fontOptions.map((font) => (
                      <option key={font} value={font}>{font}</option>
                    ))}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Domain Settings
              </CardTitle>
              <CardDescription>Configure your custom domain and URL settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="subdomain">Tithi Subdomain</Label>
                <div className="flex">
                  <Input
                    id="subdomain"
                    placeholder="luxe-spa-wellness"
                    className="rounded-r-none"
                  />
                  <div className="bg-muted px-3 py-2 border border-l-0 rounded-r-md text-sm text-muted-foreground">
                    .tithi.com
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Your current URL: luxe-spa-wellness.tithi.com</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="custom-domain">Custom Domain (Optional)</Label>
                <Input
                  id="custom-domain"
                  placeholder="booking.yourdomain.com"
                />
                <p className="text-xs text-muted-foreground">
                  Point your domain's CNAME record to: luxe-spa-wellness.tithi.com
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Live Preview</CardTitle>
              <CardDescription>See how your changes look</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border rounded-lg overflow-hidden">
                  <div className="flex items-center gap-2 p-2 bg-muted">
                    <Monitor className="h-4 w-4" />
                    <span className="text-sm">Desktop</span>
                  </div>
                  <div 
                    className="p-4 min-h-32"
                    style={{ 
                      backgroundColor: primaryColor + '10',
                      borderTop: `3px solid ${primaryColor}`
                    }}
                  >
                    <div className="text-lg font-semibold mb-2" style={{ color: primaryColor }}>
                      Luxe Spa & Wellness
                    </div>
                    <div className="text-sm text-muted-foreground mb-2">
                      Book your appointment today
                    </div>
                    <Button 
                      size="sm" 
                      style={{ backgroundColor: primaryColor, borderColor: primaryColor }}
                    >
                      Book Now
                    </Button>
                  </div>
                </div>
                
                <div className="border rounded-lg overflow-hidden">
                  <div className="flex items-center gap-2 p-2 bg-muted">
                    <Smartphone className="h-4 w-4" />
                    <span className="text-sm">Mobile</span>
                  </div>
                  <div 
                    className="p-3 min-h-24"
                    style={{ 
                      backgroundColor: primaryColor + '10',
                      borderTop: `2px solid ${primaryColor}`
                    }}
                  >
                    <div className="text-sm font-semibold mb-1" style={{ color: primaryColor }}>
                      Luxe Spa
                    </div>
                    <Button 
                      size="sm" 
                      className="w-full"
                      style={{ backgroundColor: primaryColor, borderColor: primaryColor }}
                    >
                      Book Now
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Brand Guidelines</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Logo Guidelines</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Use PNG or SVG format</li>
                  <li>• Maximum 2MB file size</li>
                  <li>• Transparent background preferred</li>
                  <li>• Minimum 200px width</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Color Usage</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Primary: Main brand color</li>
                  <li>• Secondary: Complementary actions</li>
                  <li>• Accent: Highlights and CTAs</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
