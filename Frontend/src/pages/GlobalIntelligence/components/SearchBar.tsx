import React from "react";

interface SearchBarProps {
    search: string;
    setSearch: (value: string) => void;
    countryFilter: string;
    setCountryFilter: (value: string) => void;
    miiFilter: string;
    setMiiFilter: (value: string) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({
    search,
    setSearch,
    countryFilter,
    setCountryFilter,
    miiFilter,
    setMiiFilter,
}) => {
    return (
        <div
            style={{
                width: "100%",
                maxWidth: "1200px",
                display: "flex",
                gap: "12px",
                marginBottom: "20px",
            }}
        >
            <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by Product or OEM..."
                style={{
                    flex: 1,
                    padding: "14px 18px",
                    borderRadius: "10px",
                    border: "1px solid #ccc",
                    fontSize: "15px",
                }}
            />

            <select
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
                style={{
                    padding: "14px",
                    borderRadius: "10px",
                    border: "1px solid #ccc",
                    fontSize: "15px",
                    background: "white",
                }}
            >
                <option value="All">All</option>
                <option value="India">India</option>
                <option value="Global">Global</option>
                <option value="Unknown">Unknown</option>
            </select>

            <select
                value={miiFilter}
                onChange={(e) => setMiiFilter(e.target.value)}
                style={{
                    padding: "14px",
                    borderRadius: "10px",
                    border: "1px solid #ccc",
                    fontSize: "15px",
                    background: "white",
                }}
            >
                <option>All</option>
                <option>MII</option>
                <option>Not MII</option>
            </select>
        </div>
    );
};

export default SearchBar;
